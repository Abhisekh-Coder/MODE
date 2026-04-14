"""MODE — Supabase Persistence Layer

All database operations in one place. The orchestrator and API call these
functions to persist state. If Supabase is not configured, falls back to
in-memory storage (no crash, just no persistence across restarts).
"""

import os
import json
import uuid
from datetime import datetime
from typing import Optional

_supabase = None
_fallback_mode = False


def _get_client():
    """Lazy-init Supabase client. Falls back gracefully if not configured."""
    global _supabase, _fallback_mode
    if _supabase is not None:
        return _supabase
    if _fallback_mode:
        return None

    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_KEY')
    if not url or not key:
        print('[MODE DB] No SUPABASE_URL/KEY set — running in-memory only')
        _fallback_mode = True
        return None

    try:
        from supabase import create_client
        _supabase = create_client(url, key)
        print(f'[MODE DB] Connected to Supabase: {url[:40]}...')
        return _supabase
    except Exception as e:
        print(f'[MODE DB] Supabase init failed: {e} — running in-memory')
        _fallback_mode = True
        return None


def is_connected() -> bool:
    return _get_client() is not None


# ═══════════════════════════════════════
# PLAYBOOKS
# ═══════════════════════════════════════

def create_playbook(run_id: str, member: dict) -> dict:
    row = {
        'id': run_id,
        'member': member,
        'state': 'IDLE',
        'created_at': datetime.now().isoformat(),
    }
    db = _get_client()
    if db:
        db.table('playbooks').insert(row).execute()
    return row


def update_playbook_state(run_id: str, state: str, **kwargs):
    db = _get_client()
    if not db:
        return
    data = {'state': state, **kwargs}
    db.table('playbooks').update(data).eq('id', run_id).execute()


def update_playbook_cost(run_id: str, cost_usd: float, cost_inr: float,
                         input_tokens: int, output_tokens: int):
    db = _get_client()
    if not db:
        return
    db.table('playbooks').update({
        'cost_total_usd': cost_usd,
        'cost_total_inr': cost_inr,
        'total_input_tokens': input_tokens,
        'total_output_tokens': output_tokens,
    }).eq('id', run_id).execute()


def update_playbook_markers(run_id: str, total: int, non_optimal: int):
    db = _get_client()
    if not db:
        return
    db.table('playbooks').update({
        'markers_total': total,
        'markers_non_optimal': non_optimal,
    }).eq('id', run_id).execute()


def set_approved_agents(run_id: str, approved: list):
    db = _get_client()
    if not db:
        return
    db.table('playbooks').update({'approved_agents': approved}).eq('id', run_id).execute()


def set_last_error_agent(run_id: str, agent_num: Optional[int]):
    db = _get_client()
    if not db:
        return
    db.table('playbooks').update({'last_error_agent': agent_num}).eq('id', run_id).execute()


def get_playbook(run_id: str) -> Optional[dict]:
    db = _get_client()
    if not db:
        return None
    try:
        res = db.table('playbooks').select('*').eq('id', run_id).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        print(f'[MODE DB] get_playbook error: {e}')
        return None


def list_playbooks() -> list:
    db = _get_client()
    if not db:
        return []
    try:
        res = db.table('playbooks').select('*').order('created_at', desc=True).execute()
        return res.data or []
    except Exception as e:
        print(f'[MODE DB] list_playbooks error: {e}')
        return []


# ═══════════════════════════════════════
# AGENT RUNS
# ═══════════════════════════════════════

def create_agent_run(playbook_id: str, agent_num: int, model: str,
                     prompt_chars: int, attempt: int = 1) -> int:
    db = _get_client()
    if not db:
        return 0
    row = {
        'playbook_id': playbook_id,
        'agent_num': agent_num,
        'attempt': attempt,
        'status': 'running',
        'model': model,
        'prompt_chars': prompt_chars,
        'prompt_tokens': prompt_chars // 4,
        'started_at': datetime.now().isoformat(),
    }
    res = db.table('agent_runs').insert(row).execute()
    return res.data[0]['id'] if res.data else 0


def complete_agent_run(run_row_id: int, input_tokens: int, output_tokens: int,
                       cost_usd: float, cost_inr: float, duration_ms: int, status: str = 'review'):
    db = _get_client()
    if not db:
        return
    db.table('agent_runs').update({
        'status': status,
        'input_tokens': input_tokens,
        'output_tokens': output_tokens,
        'cost_usd': cost_usd,
        'cost_inr': cost_inr,
        'duration_ms': duration_ms,
        'completed_at': datetime.now().isoformat(),
    }).eq('id', run_row_id).execute()


def fail_agent_run(run_row_id: int, duration_ms: int):
    db = _get_client()
    if not db:
        return
    db.table('agent_runs').update({
        'status': 'error',
        'duration_ms': duration_ms,
        'completed_at': datetime.now().isoformat(),
    }).eq('id', run_row_id).execute()


def get_agent_runs(playbook_id: str) -> list:
    db = _get_client()
    if not db:
        return []
    res = db.table('agent_runs').select('*').eq('playbook_id', playbook_id).order('created_at').execute()
    return res.data or []


# ═══════════════════════════════════════
# AGENT OUTPUTS
# ═══════════════════════════════════════

def save_agent_output(playbook_id: str, agent_num: int, raw_output: str,
                      parsed_output: dict, handoff_text: str = ''):
    db = _get_client()
    if not db:
        return
    row = {
        'playbook_id': playbook_id,
        'agent_num': agent_num,
        'raw_output': raw_output,
        'parsed_output': parsed_output,
        'handoff_text': handoff_text,
        'handoff_chars': len(handoff_text),
    }
    # Upsert: update if exists, insert if not
    db.table('agent_outputs').upsert(row, on_conflict='playbook_id,agent_num').execute()


def get_agent_output(playbook_id: str, agent_num: int) -> Optional[dict]:
    db = _get_client()
    if not db:
        return None
    res = db.table('agent_outputs').select('*').eq('playbook_id', playbook_id).eq('agent_num', agent_num).execute()
    return res.data[0] if res.data else None


def get_handoff(playbook_id: str, agent_num: int) -> str:
    """Get handoff text for an agent (used by next agent in chain)."""
    out = get_agent_output(playbook_id, agent_num)
    return out['handoff_text'] if out else ''


# ═══════════════════════════════════════
# UPLOAD FILES
# ═══════════════════════════════════════

def save_upload_file(playbook_id: str, file_key: str, filename: str,
                     file_type: str, file_size: int, parse_method: str,
                     result_summary: str, parse_time_ms: int = 0,
                     ocr_cost_usd: float = 0, ocr_pages: int = 0,
                     ocr_tokens: int = 0, parsed_data: dict = None):
    db = _get_client()
    if not db:
        return
    db.table('upload_files').insert({
        'playbook_id': playbook_id,
        'file_key': file_key,
        'filename': filename,
        'file_type': file_type,
        'file_size': file_size,
        'parse_method': parse_method,
        'result_summary': result_summary,
        'parse_time_ms': parse_time_ms,
        'ocr_cost_usd': ocr_cost_usd,
        'ocr_pages': ocr_pages,
        'ocr_tokens': ocr_tokens,
        'parsed_data': parsed_data,
    }).execute()


def get_upload_files(playbook_id: str) -> list:
    db = _get_client()
    if not db:
        return []
    res = db.table('upload_files').select('*').eq('playbook_id', playbook_id).order('created_at').execute()
    return res.data or []


# ═══════════════════════════════════════
# PIPELINE LOGS
# ═══════════════════════════════════════

def save_log(playbook_id: str, log_entry: dict):
    db = _get_client()
    if not db:
        return
    row = {
        'id': log_entry.get('id', uuid.uuid4().hex[:8]),
        'playbook_id': playbook_id,
        'level': log_entry.get('level', 'INFO'),
        'category': log_entry.get('category', 'general'),
        'event': log_entry.get('event', ''),
        'message': log_entry.get('message', ''),
        'agent': log_entry.get('agent'),
        'data': log_entry.get('data'),
    }
    try:
        db.table('pipeline_logs').insert(row).execute()
    except Exception:
        pass  # Don't crash pipeline for a log write failure


def get_logs(playbook_id: str, level: str = 'INFO', agent: int = None,
             search: str = None) -> list:
    db = _get_client()
    if not db:
        return []

    level_order = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']
    min_idx = level_order.index(level) if level in level_order else 2

    q = db.table('pipeline_logs').select('*').eq('playbook_id', playbook_id)

    if agent:
        q = q.eq('agent', agent)

    res = q.order('created_at').execute()
    entries = res.data or []

    # Filter by level
    filtered = [e for e in entries if level_order.index(e.get('level', 'INFO')) >= min_idx]

    if search:
        s = search.lower()
        filtered = [e for e in filtered if s in e.get('message', '').lower() or s in e.get('category', '').lower()]

    return filtered


# ═══════════════════════════════════════
# PIPELINE DATA (parsed input data)
# ═══════════════════════════════════════

def save_pipeline_data(playbook_id: str, data_key: str, content: str = None, content_json: dict = None):
    db = _get_client()
    if not db:
        return
    row = {
        'playbook_id': playbook_id,
        'data_key': data_key,
        'content': content,
        'content_json': content_json,
    }
    db.table('pipeline_data').upsert(row, on_conflict='playbook_id,data_key').execute()


def get_pipeline_data(playbook_id: str, data_key: str) -> Optional[str]:
    db = _get_client()
    if not db:
        return None
    res = db.table('pipeline_data').select('*').eq('playbook_id', playbook_id).eq('data_key', data_key).execute()
    if res.data:
        return res.data[0].get('content') or json.dumps(res.data[0].get('content_json'))
    return None


def get_all_pipeline_data(playbook_id: str) -> dict:
    db = _get_client()
    if not db:
        return {}
    res = db.table('pipeline_data').select('*').eq('playbook_id', playbook_id).execute()
    result = {}
    for row in (res.data or []):
        key = row['data_key']
        if row.get('content_json'):
            result[key] = row['content_json']
        else:
            result[key] = row.get('content', '')
    return result


# ═══════════════════════════════════════
# SETTINGS
# ═══════════════════════════════════════

def get_setting(key: str) -> Optional[dict]:
    db = _get_client()
    if not db:
        return None
    res = db.table('settings').select('value').eq('key', key).execute()
    return res.data[0]['value'] if res.data else None


def save_setting(key: str, value: dict):
    db = _get_client()
    if not db:
        return
    db.table('settings').upsert({
        'key': key,
        'value': value,
        'updated_at': datetime.now().isoformat(),
    }).execute()
