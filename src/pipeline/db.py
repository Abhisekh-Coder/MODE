"""MODE — Supabase Persistence Layer (REST API, no SDK)

Uses httpx to call Supabase PostgREST API directly.
No supabase-py dependency — keeps serverless bundle small.
"""

import os
import json
import uuid
from datetime import datetime
from typing import Optional

import urllib.request
import urllib.error

_url = None
_key = None
_headers = None
_fallback = False


def _init():
    global _url, _key, _headers, _fallback
    if _url is not None or _fallback:
        return
    _url = os.getenv('SUPABASE_URL')
    _key = os.getenv('SUPABASE_KEY')
    if not _url or not _key:
        print('[MODE DB] No SUPABASE_URL/KEY — in-memory only')
        _fallback = True
        return
    _headers = {
        'apikey': _key,
        'Authorization': f'Bearer {_key}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }
    print(f'[MODE DB] REST connected: {_url[:40]}...')


def _rest(method: str, table: str, params: str = '', body: dict = None) -> list:
    """Make a REST call to Supabase PostgREST using stdlib."""
    _init()
    if _fallback:
        return []
    try:
        url = f'{_url}/rest/v1/{table}{params}'
        data = json.dumps(body).encode() if body else None
        req = urllib.request.Request(url, data=data, method=method)
        for k, v in _headers.items():
            req.add_header(k, v)
        with urllib.request.urlopen(req, timeout=15) as resp:
            text = resp.read().decode()
            return json.loads(text) if text else []
    except urllib.error.HTTPError as e:
        print(f'[MODE DB] {method} {table} error {e.code}: {e.read().decode()[:200]}')
        return []
    except Exception as e:
        print(f'[MODE DB] {method} {table} failed: {e}')
        return []


def is_connected() -> bool:
    _init()
    return not _fallback


# ═══ PLAYBOOKS ═══

def create_playbook(run_id: str, member: dict) -> dict:
    row = {'id': run_id, 'member': member, 'state': 'IDLE'}
    _rest('POST', 'playbooks', body=row)
    return row

def update_playbook_state(run_id: str, state: str, **kwargs):
    data = {'state': state, **kwargs}
    _rest('PATCH', 'playbooks', f'?id=eq.{run_id}', data)

def update_playbook_cost(run_id: str, cost_usd: float, cost_inr: float, in_tok: int, out_tok: int):
    _rest('PATCH', 'playbooks', f'?id=eq.{run_id}', {
        'cost_total_usd': cost_usd, 'cost_total_inr': cost_inr,
        'total_input_tokens': in_tok, 'total_output_tokens': out_tok,
    })

def update_playbook_markers(run_id: str, total: int, non_optimal: int):
    _rest('PATCH', 'playbooks', f'?id=eq.{run_id}', {'markers_total': total, 'markers_non_optimal': non_optimal})

def set_approved_agents(run_id: str, approved: list):
    _rest('PATCH', 'playbooks', f'?id=eq.{run_id}', {'approved_agents': approved})

def set_last_error_agent(run_id: str, agent_num: Optional[int]):
    _rest('PATCH', 'playbooks', f'?id=eq.{run_id}', {'last_error_agent': agent_num})

def get_playbook(run_id: str) -> Optional[dict]:
    rows = _rest('GET', 'playbooks', f'?id=eq.{run_id}&limit=1')
    return rows[0] if rows else None

def list_playbooks() -> list:
    return _rest('GET', 'playbooks', '?order=created_at.desc')


# ═══ AGENT RUNS ═══

def create_agent_run(playbook_id: str, agent_num: int, model: str, prompt_chars: int, attempt: int = 1) -> int:
    rows = _rest('POST', 'agent_runs', body={
        'playbook_id': playbook_id, 'agent_num': agent_num, 'attempt': attempt,
        'status': 'running', 'model': model, 'prompt_chars': prompt_chars,
        'prompt_tokens': prompt_chars // 4, 'started_at': datetime.now().isoformat(),
    })
    return rows[0]['id'] if rows else 0

def complete_agent_run(row_id: int, in_tok: int, out_tok: int, cost_usd: float, cost_inr: float, dur_ms: int, status: str = 'review'):
    if not row_id: return
    _rest('PATCH', 'agent_runs', f'?id=eq.{row_id}', {
        'status': status, 'input_tokens': in_tok, 'output_tokens': out_tok,
        'cost_usd': cost_usd, 'cost_inr': cost_inr, 'duration_ms': dur_ms,
        'completed_at': datetime.now().isoformat(),
    })

def fail_agent_run(row_id: int, dur_ms: int):
    if not row_id: return
    _rest('PATCH', 'agent_runs', f'?id=eq.{row_id}', {'status': 'error', 'duration_ms': dur_ms, 'completed_at': datetime.now().isoformat()})

def get_agent_runs(playbook_id: str) -> list:
    return _rest('GET', 'agent_runs', f'?playbook_id=eq.{playbook_id}&order=created_at')


# ═══ AGENT OUTPUTS ═══

def save_agent_output(playbook_id: str, agent_num: int, raw_output: str, parsed_output: dict, handoff_text: str = ''):
    _init()
    if _fallback: return
    # Upsert via ON CONFLICT
    headers = {**_headers, 'Prefer': 'resolution=merge-duplicates,return=representation'}
    body = {
        'playbook_id': playbook_id, 'agent_num': agent_num,
        'raw_output': raw_output, 'parsed_output': parsed_output,
        'handoff_text': handoff_text, 'handoff_chars': len(handoff_text),
    }
    try:
        data = json.dumps(body).encode()
        req = urllib.request.Request(f'{_url}/rest/v1/agent_outputs', data=data, method='POST')
        for k, v in headers.items(): req.add_header(k, v)
        urllib.request.urlopen(req, timeout=15)
    except Exception as e:
        print(f'[MODE DB] save_agent_output error: {e}')

def get_agent_output(playbook_id: str, agent_num: int) -> Optional[dict]:
    rows = _rest('GET', 'agent_outputs', f'?playbook_id=eq.{playbook_id}&agent_num=eq.{agent_num}&limit=1')
    return rows[0] if rows else None

def get_handoff(playbook_id: str, agent_num: int) -> str:
    out = get_agent_output(playbook_id, agent_num)
    return out.get('handoff_text', '') if out else ''


# ═══ UPLOAD FILES ═══

def save_upload_file(playbook_id: str, file_key: str, filename: str, file_type: str,
                     file_size: int, parse_method: str, result_summary: str,
                     parse_time_ms: int = 0, **kwargs):
    _rest('POST', 'upload_files', body={
        'playbook_id': playbook_id, 'file_key': file_key, 'filename': filename,
        'file_type': file_type, 'file_size': file_size, 'parse_method': parse_method,
        'result_summary': result_summary, 'parse_time_ms': parse_time_ms,
    })

def get_upload_files(playbook_id: str) -> list:
    return _rest('GET', 'upload_files', f'?playbook_id=eq.{playbook_id}&order=created_at')


# ═══ LOGS ═══

def save_log(playbook_id: str, entry: dict):
    _init()
    if _fallback: return
    try:
        log_body = json.dumps({
            'id': entry.get('id', uuid.uuid4().hex[:8]),
            'playbook_id': playbook_id,
            'level': entry.get('level', 'INFO'),
            'category': entry.get('category', 'general'),
            'event': entry.get('event', ''),
            'message': entry.get('message', ''),
            'agent': entry.get('agent'),
            'data': entry.get('data'),
        }).encode()
        req = urllib.request.Request(f'{_url}/rest/v1/pipeline_logs', data=log_body, method='POST')
        for k, v in _headers.items(): req.add_header(k, v)
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass

def get_logs(playbook_id: str, level: str = 'INFO', agent: int = None, search: str = None) -> list:
    params = f'?playbook_id=eq.{playbook_id}&order=created_at'
    if agent:
        params += f'&agent=eq.{agent}'
    rows = _rest('GET', 'pipeline_logs', params)
    level_order = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']
    min_idx = level_order.index(level) if level in level_order else 2
    filtered = [r for r in rows if level_order.index(r.get('level', 'INFO')) >= min_idx]
    if search:
        s = search.lower()
        filtered = [r for r in filtered if s in r.get('message', '').lower()]
    return filtered


# ═══ PIPELINE DATA ═══

def save_pipeline_data(playbook_id: str, data_key: str, content: str = None, content_json: dict = None):
    _init()
    if _fallback: return
    headers = {**_headers, 'Prefer': 'resolution=merge-duplicates,return=representation'}
    try:
        pd_data = json.dumps({
            'playbook_id': playbook_id, 'data_key': data_key,
            'content': content, 'content_json': content_json,
        }).encode()
        req = urllib.request.Request(f'{_url}/rest/v1/pipeline_data', data=pd_data, method='POST')
        for k, v in headers.items(): req.add_header(k, v)
        urllib.request.urlopen(req, timeout=15)
    except Exception as e:
        print(f'[MODE DB] save_pipeline_data error: {e}')

def get_pipeline_data(playbook_id: str, data_key: str) -> Optional[str]:
    rows = _rest('GET', 'pipeline_data', f'?playbook_id=eq.{playbook_id}&data_key=eq.{data_key}&limit=1')
    if rows:
        return rows[0].get('content') or json.dumps(rows[0].get('content_json'))
    return None

def get_all_pipeline_data(playbook_id: str) -> dict:
    rows = _rest('GET', 'pipeline_data', f'?playbook_id=eq.{playbook_id}')
    result = {}
    for r in rows:
        k = r['data_key']
        result[k] = r.get('content_json') or r.get('content', '')
    return result


# ═══ SETTINGS ═══

def get_setting(key: str) -> Optional[dict]:
    rows = _rest('GET', 'settings', f'?key=eq.{key}&limit=1')
    return rows[0].get('value') if rows else None

def save_setting(key: str, value: dict):
    _init()
    if _fallback: return
    headers = {**_headers, 'Prefer': 'resolution=merge-duplicates,return=representation'}
    try:
        s_data = json.dumps({'key': key, 'value': value, 'updated_at': datetime.now().isoformat()}).encode()
        req = urllib.request.Request(f'{_url}/rest/v1/settings', data=s_data, method='POST')
        for k2, v2 in headers.items(): req.add_header(k2, v2)
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass
