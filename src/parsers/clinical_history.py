"""MODE — Clinical History Parser (DOCX + text)"""

def parse_clinical_history_docx(filepath: str) -> str:
    """Extract text from clinical history DOCX."""
    try:
        from docx import Document
        doc = Document(filepath)
        return '\n'.join(p.text.strip() for p in doc.paragraphs if p.text.strip())
    except ImportError:
        # Fallback: read raw bytes and extract text
        with open(filepath, 'rb') as f:
            content = f.read()
        # Simple XML text extraction
        import re
        text_parts = re.findall(rb'<w:t[^>]*>([^<]+)</w:t>', content)
        return ' '.join(p.decode('utf-8', errors='ignore') for p in text_parts)

def parse_clinical_history_text(text: str) -> dict:
    """Parse clinical history text into structured sections."""
    sections = {}
    current = 'General'
    for line in text.split('\n'):
        line = line.strip()
        if not line:
            continue
        if line.isupper() or line.endswith(':'):
            current = line.rstrip(':').title()
            sections[current] = []
        else:
            sections.setdefault(current, []).append(line)
    return {k: '\n'.join(v) for k, v in sections.items()}
