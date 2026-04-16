"""MODE — API Routes (Flask Blueprint)"""

import os
import json
import uuid
from pathlib import Path
from flask import Blueprint, request, jsonify, Response, send_file
from werkzeug.utils import secure_filename

api_bp = Blueprint('api', __name__)

# ── Resolve project root (parent of src/) ──
PROJECT_ROOT = Path(__file__).parent.parent.parent
PROMPTS_DIR = PROJECT_ROOT / 'prompts'

# In-memory cache (backed by Supabase for persistence)
pipelines = {}  # run_id -> ModePipeline

UPLOAD_DIR = os.getenv('UPLOAD_DIR', str(PROJECT_ROOT / 'uploads'))
EXPORT_DIR = os.getenv('EXPORT_DIR', str(PROJECT_ROOT / 'exports'))
SETTINGS_FILE = str(PROJECT_ROOT / 'settings.json')


def _parse_roadmap_phases(raw: str) -> list:
    """Parse Part A phases from the markdown table.

    Table format: | Phase N: Name (Months) | Focus | Objective | Nutrition | Physical | Stress | Sleep |
    Split by '| **Phase N' boundaries, then split each row by '|'.
    """
    import re

    phases = []
    phase_meta = [
        ('Groundwork', 'Months 1-4'),
        ('Integration', 'Months 5-8'),
        ('Transformation', 'Months 9-12'),
    ]

    def clean(s):
        s = re.sub(r'\*{1,2}', '', s)
        s = re.sub(r'^Why this matters:\s*', '', s, flags=re.IGNORECASE)
        return s.strip()

    # Split on phase row starts
    part_a = raw[:raw.find('PART B')] if 'PART B' in raw else raw[:6000]
    phase_rows = re.split(r'\|\s*\*{0,2}Phase\s+\d', part_a)

    for i, row in enumerate(phase_rows[1:4]):
        cells = row.split('|')
        cells = [clean(c) for c in cells if c.strip() and '---' not in c]

        name = phase_meta[i][0] if i < len(phase_meta) else f'Phase {i+1}'
        months = phase_meta[i][1] if i < len(phase_meta) else ''

        phase = {
            'name': name, 'months': months,
            'focus': cells[1] if len(cells) > 1 else '',
            'objective': cells[2] if len(cells) > 2 else '',
            'nutrition': cells[3] if len(cells) > 3 else '',
            'physical_activity': cells[4] if len(cells) > 4 else '',
            'stress': cells[5] if len(cells) > 5 else '',
            'sleep': cells[6] if len(cells) > 6 else '',
        }
        phases.append(phase)

    # Fallback if table parsing failed
    if not phases:
        for name, months in phase_meta:
            if name.lower() in raw.lower():
                phases.append({'name': name, 'months': months, 'focus': '', 'objective': '',
                               'nutrition': '', 'physical_activity': '', 'stress': '', 'sleep': ''})

    return phases


def _parse_roadmap_cards(raw: str) -> dict:
    """Parse Agent 3 raw output into structured biweekly cards.

    Format: ### WEEK X-Y / **COMPONENT** / **Title** / sections
    """
    import re

    periods = ['Week 1-2', 'Week 3-4', 'Week 5-6', 'Week 7-8', 'Week 9-10', 'Week 11-12']
    comp_map = {
        'nutrition': 'nutrition',
        'physical activity': 'physical_activity', 'physical': 'physical_activity',
        'stress': 'stress', 'stress management': 'stress',
        'sleep': 'sleep',
        'supplement': 'supplements', 'supplements': 'supplements',
    }
    grid: dict = {c: [None]*6 for c in ['nutrition','physical_activity','stress','sleep','supplements']}

    # Split by week headers: ### WEEK X-Y or ## WEEK X-Y
    week_splits = re.split(r'#{2,3}\s*(?:\*{0,2})WEEK\s*(\d+-\d+)(?:\*{0,2})', raw, flags=re.IGNORECASE)

    for i in range(1, len(week_splits), 2):
        week_num = week_splits[i].strip()  # e.g. "1-2"
        content = week_splits[i+1] if i+1 < len(week_splits) else ''

        # Map week number to period index
        pidx = -1
        for pi, p in enumerate(periods):
            if week_num in p:
                pidx = pi
                break
        if pidx < 0:
            continue

        # Split by component headers: **NUTRITION**, **PHYSICAL ACTIVITY**, etc.
        comp_splits = re.split(
            r'\n\*{2}(NUTRITION|PHYSICAL\s*ACTIVITY|STRESS(?:\s*MANAGEMENT)?|SLEEP|SUPPLEMENTS?)\*{2}',
            content, flags=re.IGNORECASE
        )

        for j in range(1, len(comp_splits), 2):
            comp_label = comp_splits[j].strip().lower()
            cell = comp_splits[j+1] if j+1 < len(comp_splits) else ''

            # Map to grid key
            comp_key = None
            for k, v in comp_map.items():
                if k in comp_label:
                    comp_key = v
                    break
            if not comp_key:
                continue

            card = _parse_single_card(cell.strip(), periods[pidx])
            grid[comp_key][pidx] = card

    # Fill empty slots
    for comp in grid:
        for pidx in range(6):
            if grid[comp][pidx] is None:
                grid[comp][pidx] = {
                    'title': '', 'intro': '', 'foxo_impact': '',
                    'why_it_works': [], 'how_to_practice': [],
                    'what_to_expect': '', 'period': periods[pidx]
                }

    return grid


def _parse_single_card(cell: str, period: str) -> dict:
    """Parse a single card cell into structured data."""
    import re
    card = {
        'title': '', 'intro': '', 'foxo_impact': '',
        'why_it_works': [], 'how_to_practice': [],
        'what_to_expect': '', 'period': period
    }

    # Title: first **bold text** after component header
    tm = re.search(r'\*\*([^*]+)\*\*', cell)
    if tm:
        title_text = tm.group(1).strip()
        # Don't use section headers as titles
        if any(k in title_text.upper() for k in ['FOXO', 'WHY IT', 'HOW TO', 'WHAT TO']):
            tm = None

    if tm:
        parts = re.split(r'\s*[—–]\s*', title_text, 1)
        card['title'] = parts[0].strip()
        if len(parts) > 1:
            card['intro'] = parts[1].strip()

        # Get intro text between title and first section
        after = cell[tm.end():]
        intro_m = re.match(r'(.+?)(?=\*\*(?:POTENTIAL|FOXO|WHY|HOW|WHAT))', after, re.DOTALL | re.IGNORECASE)
        if intro_m:
            intro = re.sub(r'\*{1,2}', '', intro_m.group(1)).strip()
            if len(intro) > 10 and not card['intro']:
                card['intro'] = intro[:300]

    # Extract sections
    section_patterns = {
        'foxo_impact': r'(?:\*\*)?(?:POTENTIAL )?FOXO SYSTEM IMPACT(?:\*\*)?[:\s]*(.+?)(?=\*\*WHY|\*\*HOW|\*\*WHAT|\Z)',
        'why_raw': r'(?:\*\*)?WHY IT WORKS(?:\*\*)?[:\s]*(.+?)(?=\*\*HOW|\*\*WHAT|\Z)',
        'how_raw': r'(?:\*\*)?HOW TO (?:PUT IT INTO )?PRACTICE(?:\*\*)?[:\s]*(.+?)(?=\*\*WHAT|\Z)',
        'what_raw': r'(?:\*\*)?WHAT TO EXPECT(?:\*\*)?[:\s]*(.+?)(?=\Z)',
    }

    for key, pat in section_patterns.items():
        m = re.search(pat, cell, re.DOTALL | re.IGNORECASE)
        if m:
            text = m.group(1).strip()
            # Clean markdown bold markers
            text = re.sub(r'\*{2}([^*]+)\*{2}', r'\1', text)

            if key == 'why_raw':
                lines = [l.strip().lstrip('•-').strip() for l in text.split('\n') if l.strip() and len(l.strip()) > 5]
                card['why_it_works'] = lines
            elif key == 'how_raw':
                lines = [l.strip().lstrip('•-').strip() for l in text.split('\n') if l.strip() and len(l.strip()) > 5]
                card['how_to_practice'] = lines
            elif key == 'foxo_impact':
                card['foxo_impact'] = text.replace('\n', ' ').strip()
            elif key == 'what_raw':
                card['what_to_expect'] = text.replace('\n', ' ').strip()[:500]

    # Fallback title from first line
    if not card['title']:
        first = cell.strip().split('\n')[0]
        card['title'] = re.sub(r'[*#|]', '', first).strip()[:80]

    return card


# ═══════════════════════════════════════
# PLAYBOOK CRUD
# ═══════════════════════════════════════

def _get_or_restore(run_id: str):
    """Get pipeline from cache, or restore from Supabase."""
    if run_id in pipelines:
        return pipelines[run_id]
    try:
        from pipeline.orchestrator import ModePipeline
        from pipeline import db
        if db.is_connected() and db.get_playbook(run_id):
            p = ModePipeline(run_id=run_id, restore=True)
            pipelines[run_id] = p
            return p
    except Exception as e:
        print(f'[MODE] Failed to restore {run_id}: {e}')
    return None


@api_bp.route('/playbooks', methods=['GET'])
def list_playbooks():
    from pipeline import db
    # Return in-memory + any DB-only playbooks
    if db.is_connected():
        db_rows = db.list_playbooks()
        # Merge: restore any DB playbooks not in memory
        for row in db_rows:
            rid = row['id']
            if rid not in pipelines:
                _get_or_restore(rid)
    return jsonify([p.get_status() for p in pipelines.values()])


@api_bp.route('/playbook', methods=['POST'])
def create_playbook():
    from pipeline.orchestrator import ModePipeline

    member = json.loads(request.form.get('member', '{}'))
    run_id = f"run-{uuid.uuid4().hex[:8]}"

    files = {}
    file_keys = ['biomarkers', 'clinical_history', 'symptoms',
                 'radiology', 'physio', 'ct_scan']

    run_dir = os.path.join(UPLOAD_DIR, run_id)
    os.makedirs(run_dir, exist_ok=True)

    for key in file_keys:
        if key in request.files:
            f = request.files[key]
            filename = secure_filename(f.filename)
            filepath = os.path.join(run_dir, filename)
            f.save(filepath)
            files[key] = filepath

    missing = [r for r in ['biomarkers', 'clinical_history', 'symptoms'] if r not in files]
    if missing:
        return jsonify({'error': f'Missing: {", ".join(missing)}'}), 400

    pipeline = ModePipeline(run_id=run_id)
    try:
        status_counts = pipeline.upload_data(files, member)
        pipelines[run_id] = pipeline
        return jsonify({'run_id': run_id, 'status': pipeline.get_status(), 'markers': status_counts})
    except Exception as e:
        pipeline.log.add('FATAL', 'pipeline', 'pipeline.crash',
                         f'Upload failed: {str(e)}', data={'error_stack': str(e)})
        return jsonify({'error': str(e), 'logs': pipeline.log.export_json()}), 500


@api_bp.route('/playbook/<run_id>', methods=['DELETE'])
def delete_playbook(run_id):
    if run_id in pipelines:
        del pipelines[run_id]
        return jsonify({'deleted': True})
    return jsonify({'error': 'not found'}), 404


# ═══════════════════════════════════════
# PIPELINE STATUS
# ═══════════════════════════════════════

@api_bp.route('/pipeline/<run_id>/status', methods=['GET'])
def pipeline_status(run_id):
    p = _get_or_restore(run_id)
    if not p:
        return jsonify({'error': 'Pipeline not found'}), 404
    return jsonify(p.get_status())


# ═══════════════════════════════════════
# AGENT EXECUTION (SSE Streaming)
# ═══════════════════════════════════════

@api_bp.route('/pipeline/<run_id>/agent/<int:agent_num>/run', methods=['GET', 'POST'])
def run_agent(run_id, agent_num):
    p = _get_or_restore(run_id)
    if not p:
        return jsonify({'error': 'Pipeline not found'}), 404

    feedback = None
    if request.method == 'POST' and request.json:
        feedback = request.json.get('feedback')
    elif request.method == 'GET':
        feedback = request.args.get('feedback')

    def generate():
        sent_log_ids = set()
        try:
            for event in p.run_agent(agent_num, feedback):
                yield f"data: {json.dumps(event)}\n\n"

                # Send only NEW log entries (no duplicates)
                for log in p.log.entries:
                    if log['id'] not in sent_log_ids:
                        sent_log_ids.add(log['id'])
                        yield f"data: {json.dumps({'type': 'log', 'entry': log})}\n\n"

        except Exception as e:
            p.log.add('ERROR', 'agent', 'agent.error',
                       f'Agent {agent_num} failed: {str(e)}',
                       data={'agent': agent_num, 'error_stack': str(e)})
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive'}
    )


# ═══════════════════════════════════════
# AGENT APPROVE / REJECT
# ═══════════════════════════════════════

@api_bp.route('/pipeline/<run_id>/agent/<int:agent_num>/approve', methods=['POST'])
def approve_agent(run_id, agent_num):
    p = _get_or_restore(run_id)
    if not p:
        return jsonify({'error': 'Pipeline not found'}), 404

    edits = request.json.get('edits') if request.json else None
    p.approve_agent(agent_num, edits)

    return jsonify({
        'approved': True,
        'agent': agent_num,
        'edits_applied': len(edits) if edits else 0,
        'status': p.get_status()
    })


@api_bp.route('/pipeline/<run_id>/agent/<int:agent_num>/reject', methods=['POST'])
def reject_agent(run_id, agent_num):
    p = _get_or_restore(run_id)
    if not p:
        return jsonify({'error': 'Pipeline not found'}), 404

    feedback = request.json.get('feedback', '') if request.json else ''
    if not feedback:
        return jsonify({'error': 'Feedback required'}), 400

    p.feedback[f'agent{agent_num}'] = feedback
    p.log.add('INFO', 'user', 'user.reject',
              f'Agent {agent_num} rejected',
              data={'agent': agent_num, 'feedback': feedback})

    return jsonify({'rejected': True, 'agent': agent_num, 'status': p.get_status()})


# ═══════════════════════════════════════
# AGENT DATA (Output, Prompt, Handoff)
# ═══════════════════════════════════════

@api_bp.route('/pipeline/<run_id>/agent/<int:agent_num>/output', methods=['GET'])
def get_output(run_id, agent_num):
    p = _get_or_restore(run_id)
    if not p:
        return jsonify({'error': 'Pipeline not found'}), 404

    output = p.outputs.get(f'agent{agent_num}')
    raw = p.raw_outputs.get(f'agent{agent_num}', '')

    return jsonify({
        'agent': agent_num,
        'has_output': output is not None,
        'parsed': output,
        'raw_length': len(raw),
        'raw_preview': raw[:5000] if raw else None  # Return more for viewing
    })


@api_bp.route('/pipeline/<run_id>/agent/<int:agent_num>/prompt', methods=['GET'])
def get_prompt(run_id, agent_num):
    p = _get_or_restore(run_id)
    if not p:
        return jsonify({'error': 'Pipeline not found'}), 404

    prompt = p._build_prompt(agent_num)
    return jsonify({'agent': agent_num, 'prompt': prompt,
                    'chars': len(prompt), 'estimated_tokens': len(prompt) // 4})


@api_bp.route('/pipeline/<run_id>/agent/<int:agent_num>/prompt', methods=['PUT'])
def update_prompt(run_id, agent_num):
    p = _get_or_restore(run_id)
    if not p:
        return jsonify({'error': 'Pipeline not found'}), 404

    new_prompt = request.json.get('prompt', '')
    p.config['agents'][agent_num]['prompt_override'] = new_prompt
    p.log.add('INFO', 'user', 'user.prompt_edited',
              f'Agent {agent_num} prompt overridden ({len(new_prompt)} chars)')
    return jsonify({'saved': True, 'chars': len(new_prompt)})


@api_bp.route('/pipeline/<run_id>/agent/<int:agent_num>/handoff', methods=['GET'])
def get_handoff(run_id, agent_num):
    p = _get_or_restore(run_id)
    if not p:
        return jsonify({'error': 'Pipeline not found'}), 404

    handoff = p.handoffs.get(f'agent{agent_num}', '')
    # If empty, try loading from Supabase
    if not handoff:
        from pipeline import db as _db
        handoff = _db.get_handoff(run_id, agent_num)
    # If still empty, return the raw output as handoff
    if not handoff:
        handoff = p.raw_outputs.get(f'agent{agent_num}', '')[:5000]
    return jsonify({'agent': agent_num, 'handoff': handoff, 'chars': len(handoff)})


@api_bp.route('/pipeline/<run_id>/agent/<int:agent_num>/raw', methods=['GET'])
def get_raw_response(run_id, agent_num):
    p = _get_or_restore(run_id)
    if not p:
        return jsonify({'error': 'Pipeline not found'}), 404

    raw = p.raw_outputs.get(f'agent{agent_num}', '')
    return jsonify({'agent': agent_num, 'raw': raw, 'chars': len(raw)})


# ═══════════════════════════════════════
# VALIDATION
# ═══════════════════════════════════════

@api_bp.route('/pipeline/<run_id>/agent/<int:agent_num>/validation', methods=['GET'])
def get_validation(run_id, agent_num):
    p = _get_or_restore(run_id)
    if not p:
        return jsonify({'error': 'Pipeline not found'}), 404

    from validators.quality_gates import validate_agent1, validate_agent2, validate_agent3

    output = p.outputs.get(f'agent{agent_num}')
    if not output:
        return jsonify({'error': 'No output to validate'}), 400

    validators = {
        1: lambda: validate_agent1(output, p.data.get('biomarkers', {})),
        2: lambda: validate_agent2(output),
        3: lambda: validate_agent3(output),
    }
    checks = validators.get(agent_num, lambda: [])()
    passed = sum(1 for c in checks if c['pass'])
    return jsonify({'agent': agent_num, 'total': len(checks), 'passed': passed, 'checks': checks})


# ═══════════════════════════════════════
# SHEET DATA
# ═══════════════════════════════════════

@api_bp.route('/pipeline/<run_id>/sheet/<int:sheet_num>', methods=['GET'])
def get_sheet_data(run_id, sheet_num):
    p = _get_or_restore(run_id)
    if not p:
        return jsonify({'error': 'Pipeline not found'}), 404

    if sheet_num == 1:
        bio = p.data.get('biomarkers', {})
        return jsonify({
            'sheet': 1, 'title': 'Input Summary',
            'member': p.member,
            'markers_total': bio.get('total_markers', 0) if isinstance(bio, dict) else 0,
            'markers_non_optimal': bio.get('non_optimal_count', 0) if isinstance(bio, dict) else 0,
            'status_counts': bio.get('status_counts', {}) if isinstance(bio, dict) else {},
            'clinical_words': len(p.data.get('clinical_history', '').split()),
            'symptoms_chars': len(p.data.get('symptoms', '')),
        })
    elif sheet_num == 2:
        bio = p.data.get('biomarkers', {})
        markers = []
        if isinstance(bio, dict):
            for section, section_markers in bio.get('sections', {}).items():
                for m in section_markers:
                    markers.append({**m, 'section': section})
        return jsonify({'sheet': 2, 'title': 'Raw Biomarkers', 'markers': markers,
                        'total': len(markers)})
    elif sheet_num == 3:
        out = p.outputs.get('agent1', {})
        return jsonify({'sheet': 3, 'title': 'Analysis', 'sections': out.get('sections', []),
                        'available': bool(out)})
    elif sheet_num == 4:
        out = p.outputs.get('agent2', {})
        return jsonify({'sheet': 4, 'title': 'Systems', 'systems': out.get('systems', []),
                        'available': bool(out)})
    elif sheet_num == 5:
        out = p.outputs.get('agent3', {})
        raw = p.raw_outputs.get('agent3', '')
        cards = _parse_roadmap_cards(raw) if raw else {}
        phases = _parse_roadmap_phases(raw) if raw else out.get('phases', [])
        return jsonify({'sheet': 5, 'title': 'Roadmap', 'phases': phases,
                        'biweekly': cards, 'raw_length': len(raw),
                        'available': bool(out or raw)})
    return jsonify({'error': 'Invalid sheet number'}), 400


# ═══════════════════════════════════════
# PROTOCOL GOALS (Agent 3 structured output)
# ═══════════════════════════════════════

@api_bp.route('/pipeline/<run_id>/protocol/generate', methods=['POST'])
def generate_protocol(run_id):
    """Map Agent 3 output into structured protocol goals and save to Supabase."""
    p = _get_or_restore(run_id)
    if not p:
        return jsonify({'error': 'Pipeline not found'}), 404

    raw = p.raw_outputs.get('agent3', '')
    if not raw:
        return jsonify({'error': 'Agent 3 has not run yet'}), 400

    from parsers.protocol_mapper import map_agent3_to_goals
    cards = _parse_roadmap_cards(raw)
    phases = _parse_roadmap_phases(raw)

    start_date = request.json.get('start_date') if request.json else None
    goals = map_agent3_to_goals(run_id, cards, phases, start_date=start_date)

    # Save to Supabase
    from pipeline import db as _db
    if _db.is_connected():
        for table, records in [
            ('protocol_phases', goals['phases']),
            ('protocol_guidelines', goals['guidelines']),
            ('supplement_goals', goals['supplements']),
            ('nutrition_goals', goals['nutrition']),
            ('sleep_goals', goals['sleep']),
            ('stress_goals', goals['stress']),
            ('activity_goals', goals['activities']),
        ]:
            for rec in records:
                _db._rest('POST', table, body=rec)

    return jsonify({
        'generated': True,
        'counts': {k: len(v) for k, v in goals.items()},
        'total': sum(len(v) for v in goals.values()),
    })


@api_bp.route('/pipeline/<run_id>/protocol', methods=['GET'])
def get_protocol(run_id):
    """Get all protocol goals for a pipeline run."""
    from pipeline import db as _db

    tables = ['protocol_phases', 'protocol_guidelines', 'supplement_goals',
              'nutrition_goals', 'sleep_goals', 'stress_goals', 'activity_goals']
    result = {}
    for t in tables:
        key = t.replace('_goals', '').replace('protocol_', '')
        rows = _db._rest('GET', t, f'?playbook_id=eq.{run_id}&order=sequence')
        result[key] = rows

    return jsonify(result)


@api_bp.route('/pipeline/<run_id>/protocol/<table>/<goal_id>', methods=['PATCH'])
def update_protocol_goal(run_id, table, goal_id):
    """Update a single protocol goal."""
    from pipeline import db as _db
    valid_tables = ['supplement_goals', 'nutrition_goals', 'sleep_goals', 'stress_goals', 'activity_goals']
    if table not in valid_tables:
        return jsonify({'error': 'Invalid table'}), 400
    _db._rest('PATCH', table, f'?id=eq.{goal_id}', request.json)
    return jsonify({'updated': True})


# ═══════════════════════════════════════
# UPLOAD FILES
# ═══════════════════════════════════════

@api_bp.route('/pipeline/<run_id>/uploads', methods=['GET'])
def get_uploads(run_id):
    p = _get_or_restore(run_id)
    if not p:
        return jsonify({'error': 'Pipeline not found'}), 404
    return jsonify(p.upload_files_info)


# ═══════════════════════════════════════
# LOGS
# ═══════════════════════════════════════

@api_bp.route('/pipeline/<run_id>/logs', methods=['GET'])
def get_logs(run_id):
    p = _get_or_restore(run_id)
    if not p:
        return jsonify({'error': 'Pipeline not found'}), 404

    level = request.args.get('level', 'INFO')
    agent = request.args.get('agent')
    search = request.args.get('search')

    logs = p.log.get_filtered(level=level, agent=int(agent) if agent else None, search=search)
    return jsonify({'run_id': run_id, 'total': len(logs), 'entries': logs})


@api_bp.route('/pipeline/<run_id>/logs/export', methods=['GET'])
def export_logs(run_id):
    p = _get_or_restore(run_id)
    if not p:
        return jsonify({'error': 'Pipeline not found'}), 404

    os.makedirs(EXPORT_DIR, exist_ok=True)
    log_path = os.path.join(EXPORT_DIR, f'{run_id}_logs.json')
    with open(log_path, 'w') as f:
        json.dump(p.log.export_json(), f, indent=2)
    return send_file(log_path, as_attachment=True, download_name=f'{run_id}_logs.json')


# ═══════════════════════════════════════
# EXPORT
# ═══════════════════════════════════════

@api_bp.route('/pipeline/<run_id>/export', methods=['GET'])
def export_xlsx(run_id):
    p = _get_or_restore(run_id)
    if not p:
        return jsonify({'error': 'Pipeline not found'}), 404

    # Allow export at any stage (will include whatever sheets are available)
    if p.state == 'IDLE':
        return jsonify({'error': 'No data uploaded yet', 'state': p.state}), 400

    os.makedirs(EXPORT_DIR, exist_ok=True)
    member_name = p.member.get('name', 'member').replace(' ', '_')
    filename = f'{member_name}_MODE_Playbook.xlsx'
    output_path = os.path.join(EXPORT_DIR, filename)

    try:
        p.export_xlsx(output_path)
        return send_file(output_path, as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ═══════════════════════════════════════
# SETTINGS — uses absolute paths
# ═══════════════════════════════════════

def _prompt_paths() -> dict:
    """Return absolute paths to prompt files."""
    return {
        'foundation': str(PROMPTS_DIR / 'foundation.txt'),
        'agent1': str(PROMPTS_DIR / 'agent1_biomarker_analysis.txt'),
        'agent2': str(PROMPTS_DIR / 'agent2_system_mapping.txt'),
        'agent3': str(PROMPTS_DIR / 'agent3_humanized_roadmap.txt'),
    }

def _load_settings():
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE) as f:
            return json.load(f)
    return {
        'agents': {
            '1': {'model': 'claude-opus-4-6', 'max_tokens': 30000,
                   'temperature': 0, 'prompt_file': 'agent1_biomarker_analysis.txt', 'enabled': True},
            '2': {'model': 'claude-sonnet-4-20250514', 'max_tokens': 25000,
                   'temperature': 0, 'prompt_file': 'agent2_system_mapping.txt', 'enabled': True},
            '3': {'model': 'claude-sonnet-4-20250514', 'max_tokens': 30000,
                   'temperature': 0, 'prompt_file': 'agent3_humanized_roadmap.txt', 'enabled': True},
        },
        'models': {
            'api_key_set': bool(os.getenv('ANTHROPIC_API_KEY')),
            'default_model': 'claude-sonnet-4-20250514',
        }
    }

def _save_settings(settings):
    with open(SETTINGS_FILE, 'w') as f:
        json.dump(settings, f, indent=2)


@api_bp.route('/settings/agents', methods=['GET'])
def get_agent_settings():
    return jsonify(_load_settings()['agents'])

@api_bp.route('/settings/agents', methods=['PUT'])
def update_agent_settings():
    settings = _load_settings()
    settings['agents'] = request.json
    _save_settings(settings)
    return jsonify({'saved': True})

@api_bp.route('/settings/prompts', methods=['GET'])
def get_prompt_settings():
    """Return prompt file contents using absolute paths."""
    paths = _prompt_paths()
    prompts = {}
    for key, filepath in paths.items():
        try:
            content = Path(filepath).read_text()
            prompts[key] = {'file': Path(filepath).name, 'content': content, 'chars': len(content)}
        except FileNotFoundError:
            prompts[key] = {'file': Path(filepath).name, 'content': '', 'chars': 0, 'error': f'Not found: {filepath}'}
    return jsonify(prompts)

@api_bp.route('/settings/prompts', methods=['PUT'])
def update_prompt_settings():
    """Save edited prompt contents to files using absolute paths."""
    updates = request.json  # {key: content_string}
    paths = _prompt_paths()
    saved = []
    for key, content in updates.items():
        filepath = paths.get(key)
        if filepath:
            Path(filepath).write_text(content)
            saved.append(key)
    return jsonify({'saved': True, 'files_updated': saved})

@api_bp.route('/settings/models', methods=['GET'])
def get_model_settings():
    settings = _load_settings()
    data = settings.get('models', {})
    # Aggregate cost from all pipelines
    total_cost = sum(p.cost_tracking['total_cost_usd'] for p in pipelines.values())
    data['cost_this_month'] = round(total_cost, 2)
    data['runs_this_month'] = len(pipelines)
    return jsonify(data)

@api_bp.route('/settings/models', methods=['PUT'])
def update_model_settings():
    settings = _load_settings()
    if 'models' not in settings:
        settings['models'] = {}
    settings['models'].update(request.json)
    _save_settings(settings)
    return jsonify({'saved': True})
