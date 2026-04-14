"""MODE — LLM Response Parsers (Agent 1, 2, 3)

Robust parsers that handle variations in agent output format.
Each parser returns structured data + handoff block for the next agent.
"""

import re


def parse_agent1_response(raw: str) -> dict:
    """Parse Agent 1 text into sections + cluster handoff."""

    # Try multiple handoff markers (agent may vary format)
    handoff = ''
    sheet3 = raw

    start_markers = [
        '--- COPY THIS TO AGENT 2 ---',
        '---COPY THIS TO AGENT 2---',
        '--- HANDOFF TO AGENT 2 ---',
        '--- CLUSTER HANDOFF ---',
        '--- MODE CLUSTER ANALYSIS ---',
        '--- BEGIN HANDOFF ---',
        'COPY THIS TO AGENT 2',
    ]
    end_markers = [
        '--- END HANDOFF ---',
        '---END HANDOFF---',
        '--- END ---',
    ]

    for sm in start_markers:
        if sm in raw:
            parts = raw.split(sm, 1)
            sheet3 = parts[0]
            rest = parts[1]
            # Find end marker
            found_end = False
            for em in end_markers:
                if em in rest:
                    handoff = rest.split(em)[0].strip()
                    found_end = True
                    break
            if not found_end:
                handoff = rest.strip()
            break

    # If no explicit markers found, try to extract cluster data as handoff
    if not handoff:
        # Look for cluster patterns like "C1 Iron" or "C1:" anywhere in the text
        cluster_pattern = r'(C[1-8]\s+\w+.*?(?:STRAINED|COMPENSATING|STABLE|FAILED).*?)(?=C[1-8]\s+\w+|SAFETY|TOP\s+3|$)'
        clusters = re.findall(cluster_pattern, raw, re.DOTALL | re.IGNORECASE)
        if clusters:
            handoff = '\n'.join(c.strip() for c in clusters)

    # Parse sections from sheet3 content
    sections = []
    parts = re.split(r'={2,}\s*(.+?)\s*={2,}', sheet3)
    for i in range(1, len(parts), 2):
        name = parts[i].strip()
        content = parts[i+1] if i+1 < len(parts) else ''
        markers = []
        for line in content.strip().split('\n'):
            if '|' not in line or '---' in line:
                continue
            cells = [c.strip() for c in line.split('|')]
            cells = [c for c in cells if c]  # Remove empty cells
            if len(cells) >= 5:
                markers.append({
                    'biomarker': cells[0],
                    'value_with_units': cells[1],
                    'optimal_range': cells[2],
                    'status': cells[3],
                    'implication': cells[4]
                })
        if name:  # Only add non-empty sections
            sections.append({'name': name, 'markers': markers})

    return {
        'sections': sections,
        'cluster_handoff': handoff,
        'raw_text': raw,
    }


def parse_agent2_response(raw: str) -> dict:
    """Parse Agent 2 text into 9 systems + system handoff."""

    # Extract handoff
    handoff = ''
    sys_text = raw

    start_markers = [
        '--- COPY THIS TO AGENT 3 ---',
        '---COPY THIS TO AGENT 3---',
        '--- HANDOFF TO AGENT 3 ---',
        '--- SYSTEM HANDOFF ---',
        '--- BEGIN HANDOFF ---',
        'COPY THIS TO AGENT 3',
    ]
    end_markers = [
        '--- END HANDOFF ---',
        '---END HANDOFF---',
        '--- END ---',
    ]

    for sm in start_markers:
        if sm in raw:
            parts = raw.split(sm, 1)
            sys_text = parts[0]
            rest = parts[1]
            found_end = False
            for em in end_markers:
                if em in rest:
                    handoff = rest.split(em)[0].strip()
                    found_end = True
                    break
            if not found_end:
                handoff = rest.strip()
            break

    # If no handoff markers, use the full raw text as handoff for Agent 3
    if not handoff:
        handoff = raw

    # Parse systems
    systems = []

    # Try pattern: "N. SystemName | State: X | Protocol: Y"
    system_pattern = r'(\d+)\.\s*(.+?)\s*\|.*?State:\s*(\w+)\s*\|\s*Protocol:\s*(\w+(?:/\w+)?)'

    # Split on system headers
    # Try various delimiters
    blocks = re.split(r'\n(?=\d+\.\s+[A-Z])', raw)
    if len(blocks) < 2:
        blocks = re.split(r'\n---\n', sys_text)
    if len(blocks) < 2:
        blocks = re.split(r'\n={3,}\s*\d+', sys_text)

    for block in blocks:
        m = re.search(system_pattern, block)
        if not m:
            continue
        n, name, state, proto = m.groups()

        def extract_field(header):
            """Extract content under a header until next header."""
            headers = ['Key Insights:', 'Root Cause Analysis:', 'Root Cause:',
                      'Clinical Implications:', 'Clarity Card:']
            # Also try with ** markdown bold
            for h_var in [header, header.replace(':', ''), f'**{header}**', f'**{header.replace(":", "")}**']:
                if h_var in block:
                    start = block.index(h_var) + len(h_var)
                    end = len(block)
                    for h in headers:
                        for h2 in [h, h.replace(':', ''), f'**{h}**', f'**{h.replace(":", "")}**']:
                            if h2 != h_var and h2 in block[start:]:
                                p = block.index(h2, start)
                                if p < end:
                                    end = p
                    return block[start:end].strip()
            return ''

        systems.append({
            'number': int(n),
            'name': name.strip(),
            'state': state,
            'protocol': proto,
            'key_insights': extract_field('Key Insights:'),
            'root_cause': extract_field('Root Cause Analysis:') or extract_field('Root Cause:'),
            'clinical_implications': extract_field('Clinical Implications:'),
            'clarity_card': extract_field('Clarity Card:'),
        })

    return {
        'systems': systems,
        'system_handoff': handoff,
        'raw_text': raw,
    }


def parse_agent3_response(raw: str) -> dict:
    """Parse Agent 3 (combined roadmap + humanized) response."""
    phases = _parse_phases(raw)
    biweekly = _parse_cards(raw)

    return {
        'phases': phases,
        'biweekly': biweekly,
        'raw_text': raw,
    }


def _parse_phases(raw):
    phases = []
    phase_names = [
        ('Groundwork', 'Months 1-4'),
        ('Integration', 'Months 5-8'),
        ('Transformation', 'Months 9-12'),
    ]
    for name, months in phase_names:
        if name.lower() in raw.lower():
            # Try to extract phase content
            idx = raw.lower().index(name.lower())
            # Get ~2000 chars after the phase name
            block = raw[idx:idx+2000]
            phases.append({
                'name': name,
                'months': months,
                'content': block[:500],
            })
    return phases


def _parse_cards(raw):
    periods = ['Week 1-2', 'Week 3-4', 'Week 5-6', 'Week 7-8', 'Week 9-10', 'Week 11-12']
    cards = {'periods': periods}
    for comp in ['nutrition', 'physical_activity', 'stress', 'sleep', 'supplements']:
        cards[comp] = []
    return cards
