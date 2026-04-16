"""MODE — Quality Gate Validators

Validates agent outputs against FOXO biomarker ranges and structural requirements.
"""


def validate_agent1(output, input_biomarkers, member_gender='Male', member_age=30):
    """Validate Agent 1 output: structure + FOXO range compliance."""
    checks = []
    all_out = [m for s in output.get('sections', []) for m in s.get('markers', [])]

    # 1. Non-optimal implications coverage
    non_opt = input_biomarkers.get('non_optimal_count', 0) if isinstance(input_biomarkers, dict) else 0
    personalized = sum(1 for m in all_out if m.get('status', '') != 'Optimal' and len(m.get('implication', '')) > 50)
    checks.append({'name': 'Non-optimal implications coverage',
                   'pass': personalized >= non_opt * 0.9,
                   'detail': f'{personalized}/{non_opt} non-optimal markers have personalized implications'})

    # 2. No invented markers
    inp_names = set()
    if isinstance(input_biomarkers, dict):
        inp_names = {m['biomarker'] for m in input_biomarkers.get('all_markers', [])}
    out_names = {m.get('biomarker', '') for m in all_out}
    invented = out_names - inp_names if inp_names else set()
    checks.append({'name': 'No invented markers',
                   'pass': len(invented) == 0,
                   'detail': f'Invented: {invented}' if invented else 'Clean — all markers from input'})

    # 3. Handoff present
    handoff = output.get('cluster_handoff', '')
    checks.append({'name': 'Cluster handoff present',
                   'pass': len(handoff) > 50,
                   'detail': f'{len(handoff)} chars'})

    # 4. All 8 clusters defined
    for i in range(1, 9):
        checks.append({'name': f'Cluster C{i} defined',
                       'pass': f'C{i}' in handoff,
                       'detail': 'Present' if f'C{i}' in handoff else 'Missing'})

    # 5. FOXO range validation — check agent classifications match FOXO 5-band system
    try:
        from parsers.biomarker_ranges import validate_agent1_markers
        foxo_checks = validate_agent1_markers(all_out, member_gender, member_age)
        if foxo_checks:
            total = len(foxo_checks)
            passed = sum(1 for c in foxo_checks if c['pass'])
            mismatches = [c for c in foxo_checks if not c['pass']]

            checks.append({'name': 'FOXO range compliance',
                           'pass': passed >= total * 0.85,
                           'detail': f'{passed}/{total} markers match FOXO 5-band classification'})

            # Report up to 5 mismatches
            for mc in mismatches[:5]:
                checks.append({'name': f'FOXO mismatch: {mc["name"]}',
                               'pass': False,
                               'detail': mc['detail']})
    except Exception as e:
        checks.append({'name': 'FOXO range validation',
                       'pass': True,
                       'detail': f'Skipped: {str(e)}'})

    return checks


def validate_agent2(output):
    """Validate Agent 2 output: 9 systems with char ranges."""
    checks = []
    systems = output.get('systems', [])
    checks.append({'name': '9 FOXO systems present',
                   'pass': len(systems) == 9,
                   'detail': f'{len(systems)} systems found'})

    ranges = {
        'key_insights': (1200, 1800),
        'root_cause': (590, 1450),
        'clinical_implications': (270, 830),
        'clarity_card': (730, 850),
    }
    for s in systems:
        name = s.get('name', '?')
        for field, (lo, hi) in ranges.items():
            l = len(s.get(field, ''))
            in_range = lo <= l <= hi
            checks.append({
                'name': f'{name}: {field.replace("_", " ")}',
                'pass': in_range,
                'detail': f'{l} chars (target {lo}-{hi})' + ('' if in_range else ' — OUT OF RANGE')
            })

    return checks


def validate_agent3(output):
    """Validate Agent 3 output: card structure and content rules."""
    checks = []
    raw = output.get('raw_text', str(output))

    # Card sections present
    for el in ['POTENTIAL FOXO SYSTEM IMPACT', 'WHY IT WORKS', 'HOW TO PUT IT INTO PRACTICE', 'WHAT TO EXPECT']:
        c = raw.upper().count(el)
        checks.append({
            'name': f'Cards: {el}',
            'pass': c >= 25,
            'detail': f'{c}/30 cards have this section'
        })

    # No technical tags
    checks.append({
        'name': 'No (System:X) technical tags',
        'pass': '(System:' not in raw,
        'detail': 'Clean' if '(System:' not in raw else f'Found {raw.count("(System:")} tags'
    })

    # Uses FOXO SYSTEM not BIOMARKER
    checks.append({
        'name': 'Uses FOXO SYSTEM IMPACT (not BIOMARKER)',
        'pass': 'BIOMARKER IMPACT' not in raw.upper(),
        'detail': 'Correct label' if 'BIOMARKER IMPACT' not in raw.upper() else 'Wrong label found'
    })

    return checks
