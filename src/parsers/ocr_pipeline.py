"""MODE — OCR Pipeline (Claude Vision + fallback)"""

import os
import base64
import anthropic

client = anthropic.Anthropic()

EXTRACTION_PROMPTS = {
    'medical_report': "Extract ALL text and data from this medical document. Preserve exact values, units, table structure. Output as structured text with section headers, all biomarker/test values. Do NOT interpret — extract verbatim.",
    'radiology': "Extract ALL text from this radiology report. Preserve patient info, study type/date, findings (verbatim with measurements), impression/conclusion.",
    'physio_assessment': "Extract ALL text from this physiotherapy assessment. Preserve ROM measurements (exact degrees), strength grading, functional assessments.",
    'ct_scan': "Extract ALL text from this CT scan report. Preserve findings by region (verbatim), measurements, impression/conclusion.",
    'symptoms_form': "Extract ALL responses from this symptom questionnaire. For each question: question text and selected response. Preserve section structure."
}

def detect_pdf_type(filepath: str) -> dict:
    """Check if PDF is text-based or scanned (needs OCR)."""
    try:
        import fitz
    except ImportError:
        return {'type': 'text', 'pages': 0, 'avg_chars': 0}
    doc = fitz.open(filepath)
    total = sum(len(p.get_text().strip()) for p in doc)
    avg = total / max(len(doc), 1)
    return {'type': 'text' if avg > 100 else 'scanned', 'pages': len(doc), 'avg_chars': round(avg)}

def extract_text_pdf(filepath: str) -> list:
    """Extract text from text-based PDF."""
    try:
        import pdfplumber
    except ImportError:
        return [{'page_number': 1, 'text': open(filepath, errors='ignore').read()[:10000], 'tables': []}]
    pages = []
    with pdfplumber.open(filepath) as pdf:
        for i, page in enumerate(pdf.pages):
            pages.append({'page_number': i+1, 'text': page.extract_text() or '', 'tables': page.extract_tables() or []})
    return pages

def ocr_with_claude_vision(filepath: str, doc_type: str = 'medical_report') -> list:
    """OCR via Claude Vision — convert PDF pages to images, send to Claude."""
    try:
        import fitz
    except ImportError:
        return [{'page_number': 1, 'text': 'OCR not available (PyMuPDF not installed)'}]
    doc = fitz.open(filepath)
    prompt = EXTRACTION_PROMPTS.get(doc_type, EXTRACTION_PROMPTS['medical_report'])
    dpi = int(os.getenv('OCR_DPI', 300))
    pages = []
    for i in range(len(doc)):
        pix = doc[i].get_pixmap(dpi=dpi)
        b64 = base64.b64encode(pix.tobytes("png")).decode('utf-8')
        resp = client.messages.create(
            model=os.getenv('SONNET_MODEL', 'claude-sonnet-4-20250514'),
            max_tokens=4000,
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}},
                {"type": "text", "text": prompt}
            ]}]
        )
        pages.append({
            'page_number': i+1, 'text': resp.content[0].text,
            'tokens': resp.usage.input_tokens + resp.usage.output_tokens, 'method': 'claude_vision'
        })
    return pages

def process_file(filepath: str, file_type: str = None) -> dict:
    """Master router — detect file type and parse accordingly."""
    from pathlib import Path
    ext = Path(filepath).suffix.lower()
    result = {'filepath': filepath, 'extension': ext, 'log': []}

    if ext in ('.xlsx', '.xls'):
        from parsers.biomarkers import parse_biomarker_xlsx
        result['log'].append(f'XLSX → pandas parse')
        result['data'] = parse_biomarker_xlsx(filepath)
        result['method'] = 'direct_parse'
    elif ext == '.docx':
        from parsers.clinical_history import parse_clinical_history_docx
        result['log'].append('DOCX → python-docx')
        result['data'] = parse_clinical_history_docx(filepath)
        result['method'] = 'direct_parse'
    elif ext == '.pdf':
        info = detect_pdf_type(filepath)
        result['log'].append(f'PDF: {info["type"]} ({info["avg_chars"]} chars/pg)')
        if info['type'] == 'text':
            result['data'] = extract_text_pdf(filepath)
            result['method'] = 'text_extraction'
        else:
            dtype = file_type or 'medical_report'
            result['data'] = ocr_with_claude_vision(filepath, dtype)
            result['method'] = 'claude_vision_ocr'
            result['log'].append(f'OCR: {len(result["data"])} pages')
    elif ext in ('.jpg', '.jpeg', '.png', '.dcm'):
        result['data'] = ocr_with_claude_vision(filepath, file_type or 'radiology')
        result['method'] = 'claude_vision_ocr'
    else:
        result['data'] = None
        result['method'] = 'unsupported'
        result['log'].append(f'Unsupported extension: {ext}')
    return result
