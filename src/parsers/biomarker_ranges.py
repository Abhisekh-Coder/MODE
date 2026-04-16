"""FOXO Biomarker Reference Ranges — lookup engine.

Loads the FOXO optimal ranges CSV and provides:
1. lookup_range(biomarker, gender, age) → {ref_low, optimal_low, optimal_high, ref_high, units}
2. classify(biomarker, value, gender, age) → LOW | LOW_NORMAL | OPTIMAL | HIGH_NORMAL | HIGH
3. get_all_ranges() → full dict for prompt injection
"""

import csv
import os
from pathlib import Path
from typing import Optional

_ranges = None
_ranges_by_name = None


def _load():
    global _ranges, _ranges_by_name
    if _ranges is not None:
        return

    csv_path = Path(__file__).parent.parent.parent / 'data' / 'foxo_ranges.csv'
    if not csv_path.exists():
        _ranges = []
        _ranges_by_name = {}
        return

    _ranges = []
    _ranges_by_name = {}
    seen = set()

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get('Biomarker', '').strip()
            if not name:
                continue

            # Skip duplicates
            key = (name, row.get('Gender', ''), row.get('Age (Low)', ''), row.get('Age (High)', ''), row.get('Female (Phases)', ''))
            if key in seen:
                continue
            seen.add(key)

            def to_float(v):
                if not v or v in ('-', '', '>', '<', '`1', 'Absent', 'Present', 'Clear', 'Pale Yellow', '>120'):
                    return None
                try:
                    return float(v.replace(',', ''))
                except (ValueError, TypeError):
                    return None

            entry = {
                'source': row.get('Source', '').strip(),
                'biomarker': name,
                'gender': row.get('Gender', 'Unisex').strip(),
                'age_low': to_float(row.get('Age (Low)', '')),
                'age_high': to_float(row.get('Age (High)', '')),
                'phase': row.get('Female (Phases)', '').strip(),
                'time_of_day': row.get('Time of Day', '').strip(),
                'ref_low': to_float(row.get('Reference Low (TC)', '')),
                'optimal_low': to_float(row.get('Optimal Low', '')),
                'optimal_high': to_float(row.get('Optimal High', '')),
                'ref_high': to_float(row.get('Reference High (TC)', '')),
                'units': row.get('Units', '').strip(),
                'report_type': row.get('Report Type', '').strip(),
            }
            _ranges.append(entry)

            # Index by normalized name
            norm = name.lower().strip()
            if norm not in _ranges_by_name:
                _ranges_by_name[norm] = []
            _ranges_by_name[norm].append(entry)


def lookup_range(biomarker: str, gender: str = 'Unisex', age: int = None) -> Optional[dict]:
    """Find the best matching FOXO range for a biomarker."""
    _load()
    norm = biomarker.lower().strip()

    candidates = _ranges_by_name.get(norm, [])
    if not candidates:
        # Try partial match
        for key, entries in _ranges_by_name.items():
            if norm in key or key in norm:
                candidates = entries
                break

    if not candidates:
        return None

    # Filter by gender
    gender_l = gender.lower() if gender else 'unisex'
    gender_match = [c for c in candidates if c['gender'].lower() in (gender_l, 'unisex')]
    if gender_match:
        candidates = gender_match

    # Filter by age
    if age and len(candidates) > 1:
        age_match = [c for c in candidates
                     if (c['age_low'] is None or age >= c['age_low'])
                     and (c['age_high'] is None or age <= c['age_high'])]
        if age_match:
            candidates = age_match

    # Return first match (most specific)
    return candidates[0] if candidates else None


def classify(biomarker: str, value: float, gender: str = 'Unisex', age: int = None) -> str:
    """Classify a biomarker value using FOXO 5-band system.

    Returns: LOW | LOW_NORMAL | OPTIMAL | HIGH_NORMAL | HIGH
    """
    r = lookup_range(biomarker, gender, age)
    if not r:
        return 'UNKNOWN'

    ref_low = r.get('ref_low')
    opt_low = r.get('optimal_low')
    opt_high = r.get('optimal_high')
    ref_high = r.get('ref_high')

    if opt_low is not None and opt_high is not None:
        if opt_low <= value <= opt_high:
            return 'OPTIMAL'

    if ref_low is not None and value < ref_low:
        return 'LOW'

    if opt_low is not None and value < opt_low:
        return 'LOW_NORMAL'

    if ref_high is not None:
        try:
            rh = float(ref_high)
            if value > rh:
                return 'HIGH'
        except (ValueError, TypeError):
            pass

    if opt_high is not None and value > opt_high:
        return 'HIGH_NORMAL'

    return 'OPTIMAL'


def get_prompt_reference() -> str:
    """Generate a text block of all FOXO ranges for prompt injection."""
    _load()
    lines = ['FOXO OPTIMAL RANGES REFERENCE (use these ranges, NOT lab reference ranges):',
             '| Biomarker | Optimal Low | Optimal High | Ref Low | Ref High | Units |',
             '|-----------|-------------|--------------|---------|----------|-------|']

    seen = set()
    for r in _ranges:
        name = r['biomarker']
        if name in seen:
            continue
        seen.add(name)

        ol = r['optimal_low'] if r['optimal_low'] is not None else '-'
        oh = r['optimal_high'] if r['optimal_high'] is not None else '-'
        rl = r['ref_low'] if r['ref_low'] is not None else '-'
        rh = r['ref_high'] if r['ref_high'] is not None else '-'
        u = r['units']
        gender = f" ({r['gender']})" if r['gender'] != 'Unisex' else ''

        lines.append(f"| {name}{gender} | {ol} | {oh} | {rl} | {rh} | {u} |")

    return '\n'.join(lines)


def validate_agent1_markers(parsed_markers: list, member_gender: str = 'Male', member_age: int = 30) -> list:
    """Validate Agent 1 output markers against FOXO ranges.

    Returns list of validation checks: {name, pass, detail}
    """
    _load()
    checks = []

    for m in parsed_markers:
        name = m.get('biomarker', '')
        value_str = m.get('value', '')
        status = m.get('severity', m.get('status', ''))

        # Try to get numeric value
        try:
            value = float(str(value_str).replace(',', '').split()[0])
        except (ValueError, TypeError):
            continue

        r = lookup_range(name, member_gender, member_age)
        if not r:
            continue

        expected = classify(name, value, member_gender, member_age)
        expected_readable = expected.replace('_', ' ').title()

        # Check if agent's status matches FOXO classification
        agent_status = status.lower().replace('-', ' ').replace('_', ' ').strip()
        expected_lower = expected.lower().replace('_', ' ')

        match = (agent_status == expected_lower or
                 (agent_status == 'optimal' and expected_lower == 'optimal') or
                 (agent_status in ('low normal', 'low-normal') and expected_lower == 'low normal') or
                 (agent_status in ('high normal', 'high-normal') and expected_lower == 'high normal') or
                 (agent_status == 'low' and expected_lower == 'low') or
                 (agent_status in ('high', 'elevated') and expected_lower in ('high', 'high normal')))

        checks.append({
            'name': f'{name} classification',
            'pass': match,
            'detail': f'{name}={value} {r["units"]}: agent says "{status}", FOXO says "{expected_readable}" (optimal {r["optimal_low"]}-{r["optimal_high"]})',
        })

    return checks
