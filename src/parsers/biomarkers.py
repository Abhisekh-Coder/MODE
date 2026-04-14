"""MODE — Biomarker XLSX Parser"""

try:
    import pandas as pd
except ImportError:
    pd = None


def parse_biomarker_xlsx(filepath: str) -> dict:
    """
    Parse FOXO biomarker mastersheet into structured data.
    
    The XLSX has columns: Biomarker | Value | Foxo Optimal Range | Foxo Severity | Implication | Correlation
    Section headers appear as rows where Value is NaN.
    """
    df = pd.read_excel(filepath, sheet_name=0)
    df.columns = [c.strip() for c in df.columns]

    sections = {}
    current_section = "Uncategorized"
    all_markers = []

    for _, row in df.iterrows():
        biomarker = str(row.get('Biomarker', '')).strip()
        value = row.get('Value')
        severity = str(row.get('Foxo Severity', '')).strip()
        optimal = str(row.get('Foxo Optimal Range', '')).strip()

        # Section header detection: Value is NaN, Severity is NaN
        if pd.isna(value) and severity in ('nan', '', 'NaN'):
            if biomarker and biomarker != 'nan':
                current_section = biomarker
                sections[current_section] = []
            continue

        # Skip rows with no valid severity
        if severity in ('nan', '', 'NaN'):
            continue

        marker = {
            'biomarker': biomarker,
            'value': value,
            'optimal_range': optimal if optimal != 'nan' else '',
            'severity': severity,
            'section': current_section
        }

        sections.setdefault(current_section, []).append(marker)
        all_markers.append(marker)

    non_optimal = [m for m in all_markers if m['severity'] != 'Optimal']

    status_counts = {}
    for m in all_markers:
        s = m['severity']
        status_counts[s] = status_counts.get(s, 0) + 1

    return {
        'sections': sections,
        'all_markers': all_markers,
        'non_optimal': non_optimal,
        'status_counts': status_counts,
        'total_markers': len(all_markers),
        'non_optimal_count': len(non_optimal)
    }


def format_sheet2_for_prompt(parsed: dict) -> str:
    """
    Format parsed biomarker data as text block for Agent 1 prompt injection.
    This becomes the {BIOMARKER_DATA} placeholder value.
    """
    lines = [
        "| Biomarker | Value | Foxo Optimal Range | Foxo Severity |",
        "|-----------|-------|--------------------|---------------|"
    ]

    current_section = None
    for marker in parsed['all_markers']:
        if marker['section'] != current_section:
            current_section = marker['section']
            lines.append(f"\n=== {current_section} ===")

        lines.append(
            f"| {marker['biomarker']} | {marker['value']} | "
            f"{marker['optimal_range']} | {marker['severity']} |"
        )

    return '\n'.join(lines)


def get_section_summary(parsed: dict) -> str:
    """Get a brief summary of sections and marker counts."""
    lines = []
    for section_name, markers in parsed['sections'].items():
        opt = sum(1 for m in markers if m['severity'] == 'Optimal')
        non = len(markers) - opt
        lines.append(f"{section_name}: {len(markers)} markers ({opt} optimal, {non} non-optimal)")
    return '\n'.join(lines)
