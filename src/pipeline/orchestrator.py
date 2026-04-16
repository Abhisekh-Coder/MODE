"""MODE — Pipeline Orchestrator (State Machine + Agent Runner)

Persists all state to Supabase. If Supabase is not configured, falls back
to in-memory only. On restart, can reload pipeline from DB and resume from
the last successful checkpoint.
"""

import os
import time
from pathlib import Path
from datetime import datetime

from parsers.biomarkers import parse_biomarker_xlsx, format_sheet2_for_prompt
from parsers.clinical_history import parse_clinical_history_docx
from parsers.ocr_pipeline import process_file
from parsers.agent_output import parse_agent1_response, parse_agent2_response, parse_agent3_response
from parsers.handoff_builder import build_agent1_handoff, build_agent2_handoff
from pipeline.log_store import LogStore
from pipeline import db
from pipeline.claude_client import stream_message

COST_TABLE = {
    'claude-opus-4-6': {'input': 15.0, 'output': 75.0},
    'claude-sonnet-4-20250514': {'input': 3.0, 'output': 15.0},
}
USD_TO_INR = 83.50


class ModePipeline:
    """
    State machine:
    IDLE → DATA_UPLOADED → AGENT_1_RUNNING → AGENT_1_REVIEW
    → AGENT_2_RUNNING → AGENT_2_REVIEW → AGENT_3_RUNNING → AGENT_3_REVIEW → COMPLETE

    Every state transition and output is persisted to Supabase.
    On error, state is recoverable — user retries the failed agent.
    """

    def __init__(self, run_id: str = None, restore: bool = False):
        self.run_id = run_id or f"run-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        self.state = 'IDLE'
        self.created_at = datetime.now().isoformat()
        self.data = {}
        self.outputs = {}
        self.raw_outputs = {}
        self.handoffs = {}
        self.feedback = {}
        self.member = {}
        self.log = LogStore(self.run_id)
        self.config = self._load_config()
        self.cost_tracking = {
            'agents': {}, 'total_cost_usd': 0.0, 'total_cost_inr': 0.0,
            'total_input_tokens': 0, 'total_output_tokens': 0,
        }
        self.last_error_agent = None
        self.approved_agents = set()
        self.upload_files_info = []  # Track upload file details

        if restore:
            self._restore_from_db()
        else:
            db.create_playbook(self.run_id, {})
            self._log('INFO', 'pipeline', 'pipeline.init', f'Pipeline created. Run: {self.run_id}')

    # ═══ CONFIG ═══

    def _load_config(self) -> dict:
        prompts_dir = Path(__file__).parent.parent.parent / 'prompts'
        foundation_path = prompts_dir / 'foundation.txt'
        foundation = foundation_path.read_text() if foundation_path.exists() else ''
        return {
            'agents': {
                1: {'model': os.getenv('OPUS_MODEL', 'claude-opus-4-6'),
                    'max_tokens': int(os.getenv('AGENT1_MAX_TOKENS', 30000)),
                    'temperature': 0,
                    'prompt_file': str(prompts_dir / 'agent1_biomarker_analysis.txt')},
                2: {'model': os.getenv('SONNET_MODEL', 'claude-sonnet-4-20250514'),
                    'max_tokens': int(os.getenv('AGENT2_MAX_TOKENS', 25000)),
                    'temperature': 0,
                    'prompt_file': str(prompts_dir / 'agent2_system_mapping.txt')},
                3: {'model': os.getenv('SONNET_MODEL', 'claude-sonnet-4-20250514'),
                    'max_tokens': int(os.getenv('AGENT3_MAX_TOKENS', 30000)),
                    'temperature': 0,
                    'prompt_file': str(prompts_dir / 'agent3_humanized_roadmap.txt')},
            },
            'foundation_prompt': foundation,
        }

    def _log(self, level, category, event, message, data=None, agent=None):
        """Log + persist to Supabase."""
        entry = self.log.add(level, category, event, message, data=data, agent=agent)
        db.save_log(self.run_id, entry)
        return entry

    def _transition(self, new_state: str):
        old = self.state
        self.state = new_state
        db.update_playbook_state(self.run_id, new_state)
        self._log('INFO', 'pipeline', 'pipeline.state_change', f'{old} → {new_state}')

    # ═══ RESTORE FROM DB (resume after restart) ═══

    def _restore_from_db(self):
        """Reload pipeline state from Supabase for resume."""
        pb = db.get_playbook(self.run_id)
        if not pb:
            return

        self.state = pb.get('state', 'IDLE')
        self.member = pb.get('member', {})
        self.created_at = pb.get('created_at', self.created_at)
        self.approved_agents = set(pb.get('approved_agents', []))
        self.last_error_agent = pb.get('last_error_agent')
        self.cost_tracking['total_cost_usd'] = pb.get('cost_total_usd', 0) or 0
        self.cost_tracking['total_cost_inr'] = pb.get('cost_total_inr', 0) or 0
        self.cost_tracking['total_input_tokens'] = pb.get('total_input_tokens', 0) or 0
        self.cost_tracking['total_output_tokens'] = pb.get('total_output_tokens', 0) or 0

        # Restore parsed data
        self.data = db.get_all_pipeline_data(self.run_id)

        # Restore agent outputs and handoffs
        for n in [1, 2, 3]:
            out = db.get_agent_output(self.run_id, n)
            if out:
                self.outputs[f'agent{n}'] = out.get('parsed_output', {})
                self.raw_outputs[f'agent{n}'] = out.get('raw_output', '')
                if out.get('handoff_text'):
                    self.handoffs[f'agent{n}'] = out['handoff_text']

        # Restore agent cost tracking
        for run in db.get_agent_runs(self.run_id):
            n = run['agent_num']
            if run.get('cost_usd'):
                self.cost_tracking['agents'][n] = {
                    'input_tokens': run.get('input_tokens', 0),
                    'output_tokens': run.get('output_tokens', 0),
                    'total_cost_usd': run.get('cost_usd', 0),
                    'total_cost_inr': run.get('cost_inr', 0),
                    'model': run.get('model', ''),
                }

        # Restore upload files
        self.upload_files_info = db.get_upload_files(self.run_id)

        # Restore logs
        self.log.entries = db.get_logs(self.run_id, level='TRACE')

        self._log('INFO', 'pipeline', 'pipeline.restored',
                  f'Pipeline restored from DB. State: {self.state}')

    # ═══ UPLOAD & PARSE ═══

    def upload_data(self, files: dict, member_details: dict) -> dict:
        self.member = member_details
        db.update_playbook_state(self.run_id, 'IDLE', member=member_details)
        self._log('INFO', 'pipeline', 'upload.start',
                  f'Processing uploads for {member_details.get("name", "Unknown")}')

        # ── Biomarkers ──
        if 'biomarkers' in files:
            t0 = time.time()
            result = process_file(files['biomarkers'])
            elapsed = int((time.time() - t0) * 1000)
            self.data['biomarkers'] = result['data']
            self.data['sheet2_text'] = format_sheet2_for_prompt(result['data'])
            total = result['data']['total_markers']
            non_opt = result['data']['non_optimal_count']

            db.save_pipeline_data(self.run_id, 'biomarkers', content_json=result['data'])
            db.save_pipeline_data(self.run_id, 'sheet2_text', content=self.data['sheet2_text'])
            db.update_playbook_markers(self.run_id, total, non_opt)
            db.save_upload_file(self.run_id, 'biomarkers',
                                Path(files['biomarkers']).name, 'Biomarker',
                                os.path.getsize(files['biomarkers']),
                                'pandas parse', f'{total} markers', elapsed)

            self.upload_files_info.append({
                'filename': Path(files['biomarkers']).name, 'file_type': 'Biomarker',
                'file_size': os.path.getsize(files['biomarkers']), 'parse_method': 'pandas parse',
                'result_summary': f'{total} markers', 'parse_time_ms': elapsed,
            })
            self._log('INFO', 'parser', 'parse.biomarkers.complete',
                      f'Biomarkers: {total} markers, {non_opt} non-optimal')

        # ── Clinical History ──
        if 'clinical_history' in files:
            t0 = time.time()
            result = process_file(files['clinical_history'])
            elapsed = int((time.time() - t0) * 1000)
            text = result['data'] if isinstance(result['data'], str) else \
                   '\n'.join(p.get('text', '') for p in result['data'])
            self.data['clinical_history'] = text
            words = len(text.split())

            db.save_pipeline_data(self.run_id, 'clinical_history', content=text)
            db.save_upload_file(self.run_id, 'clinical_history',
                                Path(files['clinical_history']).name, 'Clinical Hx',
                                os.path.getsize(files['clinical_history']),
                                result['method'], f'{words:,} words', elapsed)

            self.upload_files_info.append({
                'filename': Path(files['clinical_history']).name, 'file_type': 'Clinical Hx',
                'file_size': os.path.getsize(files['clinical_history']),
                'parse_method': result['method'], 'result_summary': f'{words:,} words',
                'parse_time_ms': elapsed,
            })
            self._log('INFO', 'parser', 'parse.clinical.complete',
                      f'Clinical history: {words:,} words via {result["method"]}')

        # ── Symptoms ──
        if 'symptoms' in files:
            t0 = time.time()
            result = process_file(files['symptoms'], file_type='symptoms_form')
            elapsed = int((time.time() - t0) * 1000)
            text = '\n'.join(p.get('text', '') for p in result['data']) \
                   if isinstance(result['data'], list) else str(result['data'])
            self.data['symptoms'] = text

            db.save_pipeline_data(self.run_id, 'symptoms', content=text)
            db.save_upload_file(self.run_id, 'symptoms',
                                Path(files['symptoms']).name, 'Symptoms',
                                os.path.getsize(files['symptoms']),
                                result['method'], f'{len(text):,} chars', elapsed)

            self.upload_files_info.append({
                'filename': Path(files['symptoms']).name, 'file_type': 'Symptoms',
                'file_size': os.path.getsize(files['symptoms']),
                'parse_method': result['method'], 'result_summary': f'{len(text):,} chars',
                'parse_time_ms': elapsed,
            })
            self._log('INFO', 'parser', 'parse.symptoms.complete',
                      f'Symptoms parsed via {result["method"]}')

        # ── Optional ──
        for key, label in [('radiology', 'Radiology'), ('physio', 'Physio'), ('ct_scan', 'CT Scan')]:
            if key in files:
                result = process_file(files[key], file_type=key)
                text = '\n'.join(p.get('text', '') for p in result['data']) \
                       if isinstance(result['data'], list) else str(result['data'])
                self.data[key] = text
                db.save_pipeline_data(self.run_id, key, content=text)

        self._transition('DATA_UPLOADED')
        self._log('INFO', 'pipeline', 'upload.complete', 'All files processed. Ready for Agent 1.')
        return self.data.get('biomarkers', {}).get('status_counts', {})

    # ═══ PROMPT BUILDING ═══

    def _ensure_handoffs(self):
        """Load handoffs from DB/builder if not in memory. Called before every prompt build."""
        # Agent 1 handoff (needed by Agent 2)
        if not self.handoffs.get('agent1'):
            h = db.get_handoff(self.run_id, 1)
            if h:
                self.handoffs['agent1'] = h
                self._log('DEBUG', 'agent', 'agent.handoff_loaded', f'Agent 1 handoff loaded from DB ({len(h)} chars)', agent=1)
            else:
                # Try building from parsed output
                out = self.outputs.get('agent1') or {}
                parsed = out if isinstance(out, dict) and 'sections' in out else {}
                if not parsed:
                    db_out = db.get_agent_output(self.run_id, 1)
                    if db_out:
                        parsed = db_out.get('parsed_output', {}) or {}
                if parsed and parsed.get('sections'):
                    h = build_agent1_handoff(parsed, self.data.get('biomarkers', {}), self.raw_outputs.get('agent1', ''))
                    self.handoffs['agent1'] = h
                    db.save_agent_output(self.run_id, 1,
                                         self.raw_outputs.get('agent1', ''), parsed, h)
                    self._log('INFO', 'agent', 'agent.handoff_built', f'Agent 1 handoff built ({len(h)} chars)', agent=1)

        # Agent 2 handoff (needed by Agent 3)
        if not self.handoffs.get('agent2'):
            h = db.get_handoff(self.run_id, 2)
            if h:
                self.handoffs['agent2'] = h
                self._log('DEBUG', 'agent', 'agent.handoff_loaded', f'Agent 2 handoff loaded from DB ({len(h)} chars)', agent=2)
            else:
                out = self.outputs.get('agent2') or {}
                parsed = out if isinstance(out, dict) and 'systems' in out else {}
                if not parsed:
                    db_out = db.get_agent_output(self.run_id, 2)
                    if db_out:
                        parsed = db_out.get('parsed_output', {}) or {}
                if parsed and parsed.get('systems'):
                    h = build_agent2_handoff(parsed, self.raw_outputs.get('agent2', ''))
                    self.handoffs['agent2'] = h
                    db.save_agent_output(self.run_id, 2,
                                         self.raw_outputs.get('agent2', ''), parsed, h)
                    self._log('INFO', 'agent', 'agent.handoff_built', f'Agent 2 handoff built ({len(h)} chars)', agent=2)

    def _build_prompt(self, agent_num: int, feedback: str = None) -> str:
        # Always ensure handoffs are loaded before building prompt
        self._ensure_handoffs()

        config = self.config['agents'][agent_num]
        if config.get('prompt_override'):
            template = config['prompt_override']
        else:
            template = Path(config['prompt_file']).read_text()

        foundation = self.config['foundation_prompt']
        prompt = template.replace('{FOUNDATION_PROMPT}', foundation)
        # Inject FOXO ranges reference for Agent 1
        try:
            from parsers.biomarker_ranges import get_prompt_reference
            prompt = prompt.replace('{FOXO_RANGES}', get_prompt_reference())
        except Exception:
            prompt = prompt.replace('{FOXO_RANGES}', '')

        prompt = prompt.replace('{BIOMARKER_DATA}', self.data.get('sheet2_text', ''))
        prompt = prompt.replace('{CLINICAL_HISTORY}', self.data.get('clinical_history', ''))
        prompt = prompt.replace('{SYMPTOMS_DATA}', self.data.get('symptoms', ''))
        prompt = prompt.replace('{AGENT_1_CLUSTER_HANDOFF}', self.handoffs.get('agent1', ''))
        prompt = prompt.replace('{AGENT_2_SYSTEM_HANDOFF}', self.handoffs.get('agent2', ''))

        advanced = ''
        for key, label in [('radiology', 'RADIOLOGY'), ('physio', 'PHYSIO'), ('ct_scan', 'CT SCAN')]:
            if key in self.data:
                advanced += f'\n═══ {label} ═══\n{self.data[key]}\n'
        prompt = prompt.replace('{ADVANCED_INPUTS}', advanced)
        prompt = prompt.replace('{MEDICATIONS_LIST}', self.data.get('medications', 'No medications listed.'))
        prompt = prompt.replace('{RADIOLOGY_REPORTS}', self.data.get('radiology', ''))
        prompt = prompt.replace('{PHYSIO_ASSESSMENT}', self.data.get('physio', ''))
        prompt = prompt.replace('{CT_SCAN_REPORTS}', self.data.get('ct_scan', ''))

        if feedback:
            prompt += f'\n\n--- USER FEEDBACK ---\n{feedback}\n--- END FEEDBACK ---'

        est = len(prompt) // 4
        self._log('INFO', 'agent', 'agent.prompt_built',
                  f'Agent {agent_num} prompt: {len(prompt):,} chars, ~{est:,} tokens',
                  data={'full_prompt': prompt, 'agent': agent_num, 'chars': len(prompt),
                        'est_tokens': est, 'model': config['model']}, agent=agent_num)
        return prompt

    # ═══ COST ═══

    def _calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> dict:
        rates = COST_TABLE.get(model, COST_TABLE['claude-sonnet-4-20250514'])
        ic = (input_tokens / 1_000_000) * rates['input']
        oc = (output_tokens / 1_000_000) * rates['output']
        t = ic + oc
        return {'input_tokens': input_tokens, 'output_tokens': output_tokens,
                'total_cost_usd': round(t, 4), 'total_cost_inr': round(t * USD_TO_INR, 2), 'model': model}

    # ═══ AGENT EXECUTION ═══

    def run_agent(self, agent_num: int, feedback: str = None):
        self._transition(f'AGENT_{agent_num}_RUNNING')
        self.last_error_agent = None
        db.set_last_error_agent(self.run_id, None)

        prompt = self._build_prompt(agent_num, feedback)
        config = self.config['agents'][agent_num]

        # Count attempts
        existing_runs = [r for r in db.get_agent_runs(self.run_id) if r['agent_num'] == agent_num]
        attempt = len(existing_runs) + 1

        run_row_id = db.create_agent_run(self.run_id, agent_num, config['model'], len(prompt), attempt)

        self._log('INFO', 'agent', 'agent.start',
                  f'Agent {agent_num} starting (attempt {attempt}). Model: {config["model"]}. ~{len(prompt)//4:,} tokens',
                  agent=agent_num)

        start_time = time.time()
        collected = ''
        in_tok = out_tok = 0

        try:
            for event in stream_message(
                model=config['model'], max_tokens=config['max_tokens'],
                temperature=config['temperature'],
                messages=[{'role': 'user', 'content': prompt}]
            ):
                if event['type'] == 'text':
                    collected += event['text']
                    yield {'type': 'chunk', 'text': event['text']}
                elif event['type'] == 'done':
                    in_tok = event.get('input_tokens', 0)
                    out_tok = event.get('output_tokens', 0)

            duration = time.time() - start_time
            dur_ms = int(duration * 1000)
            self.raw_outputs[f'agent{agent_num}'] = collected

            cost = self._calculate_cost(config['model'], in_tok, out_tok)
            self.cost_tracking['agents'][agent_num] = cost
            self.cost_tracking['total_cost_usd'] += cost['total_cost_usd']
            self.cost_tracking['total_cost_inr'] += cost['total_cost_inr']
            self.cost_tracking['total_input_tokens'] += in_tok
            self.cost_tracking['total_output_tokens'] += out_tok

            db.complete_agent_run(run_row_id, in_tok, out_tok, cost['total_cost_usd'], cost['total_cost_inr'], dur_ms)
            db.update_playbook_cost(self.run_id, self.cost_tracking['total_cost_usd'],
                                    self.cost_tracking['total_cost_inr'],
                                    self.cost_tracking['total_input_tokens'],
                                    self.cost_tracking['total_output_tokens'])

            self._log('INFO', 'agent', 'agent.complete',
                      f'Agent {agent_num} done. {in_tok:,} in + {out_tok:,} out, {duration:.0f}s, '
                      f'${cost["total_cost_usd"]:.2f} (₹{cost["total_cost_inr"]:.0f})',
                      data={'agent': agent_num, 'duration_ms': dur_ms, 'cost': cost,
                            'input_tokens': in_tok, 'output_tokens': out_tok,
                            'model': config['model'], 'output_chars': len(collected),
                            'full_response': collected}, agent=agent_num)

            # Parse
            parsers = {1: parse_agent1_response, 2: parse_agent2_response, 3: parse_agent3_response}
            parsed = parsers[agent_num](collected)
            self.outputs[f'agent{agent_num}'] = parsed

            # Extract handoff — use builder if parser returns empty
            handoff = ''
            if agent_num == 1:
                handoff = parsed.get('cluster_handoff', '')
                if not handoff or len(handoff) < 50:
                    self._log('INFO', 'agent', 'agent.handoff_building',
                              'No explicit handoff found in Agent 1 output. Building from parsed data.',
                              agent=1)
                    handoff = build_agent1_handoff(parsed, self.data.get('biomarkers', {}), collected)
                self.handoffs['agent1'] = handoff
            elif agent_num == 2:
                handoff = parsed.get('system_handoff', '')
                if not handoff or len(handoff) < 50:
                    self._log('INFO', 'agent', 'agent.handoff_building',
                              'No explicit handoff found in Agent 2 output. Building from parsed data.',
                              agent=2)
                    handoff = build_agent2_handoff(parsed, collected)
                self.handoffs['agent2'] = handoff

            # Persist output + handoff
            db.save_agent_output(self.run_id, agent_num, collected, parsed, handoff)

            if handoff:
                self._log('INFO', 'agent', 'agent.handoff',
                          f'Handoff extracted: {len(handoff):,} chars', agent=agent_num)

            self._run_validation(agent_num, parsed)
            self._transition(f'AGENT_{agent_num}_REVIEW')
            yield {'type': 'complete', 'parsed': parsed}

        except Exception as e:
            dur_ms = int((time.time() - start_time) * 1000)
            self.last_error_agent = agent_num
            db.set_last_error_agent(self.run_id, agent_num)
            db.fail_agent_run(run_row_id, dur_ms)

            # Save partial output if any
            if collected:
                db.save_agent_output(self.run_id, agent_num, collected, {}, '')

            self._log('ERROR', 'agent', 'agent.error',
                      f'Agent {agent_num} failed after {dur_ms/1000:.0f}s: {str(e)}',
                      data={'agent': agent_num, 'error_stack': str(e), 'duration_ms': dur_ms,
                            'partial_chars': len(collected), 'recoverable': True}, agent=agent_num)

            self.state = f'AGENT_{agent_num}_RUNNING'
            db.update_playbook_state(self.run_id, self.state)
            yield {'type': 'error', 'message': str(e), 'recoverable': True, 'agent': agent_num}

    def _run_validation(self, agent_num, parsed):
        try:
            from validators.quality_gates import validate_agent1, validate_agent2, validate_agent3
            v = {1: lambda: validate_agent1(parsed, self.data.get('biomarkers', {})),
                 2: lambda: validate_agent2(parsed), 3: lambda: validate_agent3(parsed)}
            checks = v.get(agent_num, lambda: [])()
            passed = sum(1 for c in checks if c['pass'])
            self._log('INFO', 'validate', 'validate.complete',
                      f'Agent {agent_num}: {passed}/{len(checks)} checks passed',
                      data={'validation_results': checks, 'agent': agent_num}, agent=agent_num)
        except Exception as e:
            self._log('WARN', 'validate', 'validate.error',
                      f'Validation skipped: {str(e)}', agent=agent_num)

    # ═══ APPROVE / REJECT ═══

    def approve_agent(self, agent_num: int, edits: dict = None):
        if edits:
            self._apply_edits(agent_num, edits)
            if agent_num == 1:
                self.handoffs['agent1'] = self.outputs['agent1'].get('cluster_handoff', '')
            elif agent_num == 2:
                self.handoffs['agent2'] = self.outputs['agent2'].get('system_handoff', '')
            self._log('INFO', 'user', 'user.approve_edited', f'Agent {agent_num} approved with edits', agent=agent_num)
        else:
            self._log('INFO', 'user', 'user.approve', f'Agent {agent_num} approved', agent=agent_num)

        self.approved_agents.add(agent_num)
        db.set_approved_agents(self.run_id, list(self.approved_agents))

        if agent_num >= 3:
            self._transition('COMPLETE')
            self._log('INFO', 'pipeline', 'pipeline.complete',
                      f'Pipeline complete. ${self.cost_tracking["total_cost_usd"]:.2f} (₹{self.cost_tracking["total_cost_inr"]:.0f})')
        else:
            self._transition(f'AGENT_{agent_num}_REVIEW')

    def reject_agent(self, agent_num: int, feedback: str):
        self.feedback[f'agent{agent_num}'] = feedback
        self._log('INFO', 'user', 'user.reject', f'Agent {agent_num} rejected', agent=agent_num)
        return self.run_agent(agent_num, feedback=feedback)

    def _apply_edits(self, agent_num, edits):
        output = self.outputs[f'agent{agent_num}']
        for path, value in edits.items():
            keys = path.split('.')
            obj = output
            for key in keys[:-1]:
                obj = obj[int(key)] if key.isdigit() else obj[key]
            final = keys[-1]
            if final.isdigit():
                obj[int(final)] = value
            else:
                obj[final] = value

    # ═══ EXPORT ═══

    def export_xlsx(self, output_path: str):
        from builders.xlsx_builder import build_workbook
        self._log('INFO', 'export', 'export.start', 'Building XLSX')
        build_workbook(self, output_path)
        self._log('INFO', 'export', 'export.complete', f'XLSX saved: {output_path}')

    # ═══ STATUS ═══

    def get_status(self) -> dict:
        return {
            'run_id': self.run_id, 'state': self.state, 'member': self.member,
            'created_at': self.created_at,
            'markers_total': self.data.get('biomarkers', {}).get('total_markers') if isinstance(self.data.get('biomarkers'), dict) else None,
            'markers_non_optimal': self.data.get('biomarkers', {}).get('non_optimal_count') if isinstance(self.data.get('biomarkers'), dict) else None,
            'cost_total': self.cost_tracking['total_cost_usd'],
            'cost_tracking': self.cost_tracking,
            'upload_files': self.upload_files_info,
            'agents': {1: self._agent_status(1), 2: self._agent_status(2), 3: self._agent_status(3)},
        }

    def _agent_status(self, n):
        key = f'agent{n}'
        cost = self.cost_tracking['agents'].get(n, {})
        base = {
            'tokens_in': cost.get('input_tokens', 0), 'tokens_out': cost.get('output_tokens', 0),
            'cost': cost.get('total_cost_usd', 0), 'cost_inr': cost.get('total_cost_inr', 0),
            'model': self.config['agents'][n]['model'],
        }
        if n in self.approved_agents:
            base.update(status='complete', has_output=True)
        elif self.last_error_agent == n:
            base.update(status='error', has_output=bool(self.raw_outputs.get(key)))
        elif self.state == f'AGENT_{n}_RUNNING':
            base['status'] = 'running'
        elif self.state == f'AGENT_{n}_REVIEW':
            base.update(status='review', has_output=True)
        elif key in self.outputs:
            base.update(status='complete', has_output=True)
        else:
            base['status'] = 'waiting'
        return base
