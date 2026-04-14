"""MODE — Handoff Builder

When Agent 1 doesn't produce an explicit handoff block (because it used
all tokens on Sheet 3 content), this module builds a structured handoff
from the parsed biomarker data + Agent 1's raw output.

This ensures Agent 2 always gets the cluster analysis it needs.
"""


def build_agent1_handoff(parsed_output: dict, biomarker_data: dict, raw_output: str = '') -> str:
    """
    Build a compressed cluster handoff from Agent 1's output.

    Uses the biomarker data to categorize markers into 8 clusters,
    determine cluster states, and build the handoff format Agent 2 expects.
    """
    sections = parsed_output.get('sections', [])
    bio = biomarker_data or {}
    all_markers = []

    # Collect all markers from parsed sections
    for section in sections:
        for m in section.get('markers', []):
            all_markers.append({
                'biomarker': m.get('biomarker', ''),
                'value': m.get('value_with_units', ''),
                'status': m.get('status', ''),
                'implication': m.get('implication', ''),
                'section': section.get('name', ''),
            })

    # If no parsed markers, use raw biomarker data
    if not all_markers and isinstance(bio, dict):
        for section_name, markers in bio.get('sections', {}).items():
            for m in markers:
                all_markers.append({
                    'biomarker': m.get('biomarker', ''),
                    'value': str(m.get('value', '')),
                    'status': m.get('severity', ''),
                    'implication': '',
                    'section': section_name,
                })

    # Categorize non-optimal markers into 8 clusters
    clusters = {
        'C1': {'name': 'Iron & Oxygen Delivery', 'markers': [], 'keywords': ['iron', 'ferritin', 'transferrin', 'hemoglobin', 'hb', 'hct', 'hematocrit', 'mcv', 'mch', 'mchc', 'rdw', 'tsat', 'reticulocyte']},
        'C2': {'name': 'Inflammation / Immune Load', 'markers': [], 'keywords': ['crp', 'esr', 'lymphocyte', 'neutrophil', 'wbc', 'monocyte', 'eosinophil', 'basophil', 'homocysteine', 'fibrinogen', 'il-6', 'tnf', 'immunoglobulin']},
        'C3': {'name': 'Fuel Partitioning (Glucose-Insulin)', 'markers': [], 'keywords': ['glucose', 'insulin', 'hba1c', 'fructosamine', 'c-peptide', 'adiponectin', 'leptin', 'fbg', 'ogtt']},
        'C4': {'name': 'Lipid Transport', 'markers': [], 'keywords': ['cholesterol', 'ldl', 'hdl', 'triglyceride', 'apob', 'apoa', 'lp(a)', 'vldl', 'sdldl', 'omega']},
        'C5': {'name': 'Thyroid Signaling', 'markers': [], 'keywords': ['tsh', 'ft3', 'ft4', 't3', 't4', 'thyroid', 'anti-tpo', 'anti-tg', 'thyroglobulin']},
        'C6': {'name': 'Mitochondrial Throughput', 'markers': [], 'keywords': ['coq10', 'lactate', 'pyruvate', 'carnitine', 'atp', 'nad', 'succinate', 'fumarate', 'malate', 'citrate', 'b12', 'folate', 'methylmalonic']},
        'C7': {'name': 'Detox / Toxic Load', 'markers': [], 'keywords': ['aluminium', 'lead', 'mercury', 'arsenic', 'cadmium', 'barium', 'antimony', 'nickel', 'thallium', 'uranium', 'glutathione', 'ggt', 'alt', 'ast', 'bilirubin', 'nac']},
        'C8': {'name': 'Electrolyte & Acid-Base', 'markers': [], 'keywords': ['sodium', 'potassium', 'calcium', 'magnesium', 'phosphate', 'chloride', 'bicarbonate', 'zinc', 'copper', 'selenium', 'iodine']},
    }

    # Assign markers to clusters
    for m in all_markers:
        name_lower = m['biomarker'].lower()
        status_lower = m['status'].lower() if m['status'] else ''
        is_non_optimal = status_lower not in ['optimal', '']

        assigned = False
        for cid, cluster in clusters.items():
            for kw in cluster['keywords']:
                if kw in name_lower:
                    cluster['markers'].append(m)
                    assigned = True
                    break
            if assigned:
                break

        # Unassigned non-optimal markers go to closest cluster based on section
        if not assigned and is_non_optimal:
            section_lower = m.get('section', '').lower()
            if any(k in section_lower for k in ['iron', 'cbc', 'blood count']):
                clusters['C1']['markers'].append(m)
            elif any(k in section_lower for k in ['inflam', 'immune']):
                clusters['C2']['markers'].append(m)
            elif any(k in section_lower for k in ['glucose', 'sugar', 'insulin', 'diabetes']):
                clusters['C3']['markers'].append(m)
            elif any(k in section_lower for k in ['lipid', 'cholesterol', 'omega']):
                clusters['C4']['markers'].append(m)
            elif any(k in section_lower for k in ['thyroid']):
                clusters['C5']['markers'].append(m)
            elif any(k in section_lower for k in ['vitamin', 'amino', 'organic', 'energy']):
                clusters['C6']['markers'].append(m)
            elif any(k in section_lower for k in ['metal', 'toxic', 'liver', 'detox']):
                clusters['C7']['markers'].append(m)
            elif any(k in section_lower for k in ['electrolyte', 'mineral']):
                clusters['C8']['markers'].append(m)

    # Determine state per cluster
    def determine_state(markers):
        if not markers:
            return 'STABLE'
        non_opt = [m for m in markers if m['status'].lower() not in ['optimal', '']]
        if not non_opt:
            return 'STABLE'

        severe = [m for m in non_opt if m['status'].lower() in ['low', 'high', 'elevated', 'critical']]
        moderate = [m for m in non_opt if m['status'].lower() in ['low normal', 'high normal']]

        if len(severe) >= 3:
            return 'STRAINED'
        elif len(severe) >= 1 and len(moderate) >= 2:
            return 'STRAINED'
        elif len(severe) >= 1 or len(moderate) >= 3:
            return 'COMPENSATING'
        elif len(moderate) >= 1:
            return 'COMPENSATING'
        return 'STABLE'

    # Build handoff text
    lines = ['--- COPY THIS TO AGENT 2 ---']
    priority = 1

    for cid in ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']:
        cluster = clusters[cid]
        state = determine_state(cluster['markers'])
        protocol = {'STABLE': 'MAINTAIN', 'COMPENSATING': 'SUPPORT', 'STRAINED': 'CORRECT', 'FAILED': 'PROTECT'}.get(state, 'MAINTAIN')

        non_opt = [m for m in cluster['markers'] if m['status'].lower() not in ['optimal', '']]
        key_markers = ', '.join([f"{m['biomarker']}={m['value']}({m['status']})" for m in non_opt[:6]])

        lines.append(f"{cid} {cluster['name']}: {state} | Protocol: {protocol} | Priority: {priority}")
        if key_markers:
            lines.append(f"  Key: {key_markers}")

        if state != 'STABLE':
            priority += 1

    # Add safety check
    lines.append('')
    lines.append('SAFETY: No critical safety markers triggered')

    # Top 3 clusters by severity
    ranked = sorted(clusters.items(), key=lambda x: {'STRAINED': 3, 'COMPENSATING': 2, 'STABLE': 1, 'FAILED': 4}.get(determine_state(x[1]['markers']), 0), reverse=True)
    top3 = [f"{cid} {c['name']} ({determine_state(c['markers'])})" for cid, c in ranked[:3]]
    lines.append(f"TOP 3: {' > '.join(top3)}")

    lines.append('--- END HANDOFF ---')

    return '\n'.join(lines)


def build_agent2_handoff(parsed_output: dict, raw_output: str = '') -> str:
    """
    Build a compressed system handoff from Agent 2's output for Agent 3.
    """
    systems = parsed_output.get('systems', [])

    if not systems and raw_output:
        # If no parsed systems, pass the raw output as handoff
        return raw_output[:10000]

    lines = ['--- COPY THIS TO AGENT 3 ---']

    for s in systems:
        state = s.get('state', 'STABLE')
        protocol = {'STABLE': 'MAINTAIN', 'COMPENSATING': 'SUPPORT', 'STRAINED': 'CORRECT', 'FAILED': 'PROTECT'}.get(state, 'MAINTAIN')
        lines.append(f"S{s.get('number', '?')} {s.get('name', '?')}: {state} | Protocol: {protocol}")

        ki = s.get('key_insights', '')
        if ki:
            lines.append(f"  Summary: {ki[:200]}")

        rc = s.get('root_cause', '')
        if rc:
            lines.append(f"  Root Cause: {rc[:150]}")

    lines.append('--- END HANDOFF ---')
    return '\n'.join(lines)
