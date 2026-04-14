"""Vercel Serverless — lightweight Python handler (no Flask)."""

import sys
import os
import json
from pathlib import Path
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Add src/ to path
src_dir = str(Path(__file__).parent.parent / 'src')
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)
os.chdir(str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        return self._handle()

    def do_POST(self):
        return self._handle()

    def do_PUT(self):
        return self._handle()

    def do_PATCH(self):
        return self._handle()

    def do_DELETE(self):
        return self._handle()

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _json_response(self, data, status=200):
        self.send_response(status)
        self._cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _get_body(self):
        length = int(self.headers.get('Content-Length', 0))
        if length > 0:
            return json.loads(self.rfile.read(length))
        return {}

    def _handle(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')
        params = parse_qs(parsed.query)

        # Health check
        if path == '/api/health':
            return self._json_response({'status': 'ok', 'service': 'mode-serverless'})

        # Settings
        if path == '/api/settings/prompts':
            return self._handle_prompts()
        if path == '/api/settings/models':
            return self._json_response({'api_key_set': bool(os.getenv('ANTHROPIC_API_KEY')), 'default_model': 'claude-sonnet-4-20250514'})

        # Playbooks
        if path == '/api/playbooks':
            return self._handle_playbooks()

        # Pipeline operations — delegate to Supabase
        if '/pipeline/' in path:
            return self._handle_pipeline(path, params)

        return self._json_response({'error': 'Not found', 'path': path}, 404)

    def _handle_prompts(self):
        prompts_dir = Path(__file__).parent.parent / 'prompts'
        files = {
            'foundation': 'foundation.txt',
            'agent1': 'agent1_biomarker_analysis.txt',
            'agent2': 'agent2_system_mapping.txt',
            'agent3': 'agent3_humanized_roadmap.txt',
        }
        result = {}
        for key, fname in files.items():
            fpath = prompts_dir / fname
            try:
                content = fpath.read_text()
                result[key] = {'file': fname, 'content': content, 'chars': len(content)}
            except FileNotFoundError:
                result[key] = {'file': fname, 'content': '', 'chars': 0}
        return self._json_response(result)

    def _handle_playbooks(self):
        from pipeline import db
        if db.is_connected():
            rows = db.list_playbooks()
            return self._json_response(rows)
        return self._json_response([])

    def _handle_pipeline(self, path, params):
        from pipeline import db
        import re

        # Extract run_id
        m = re.search(r'/pipeline/([^/]+)', path)
        if not m:
            return self._json_response({'error': 'Invalid path'}, 400)
        run_id = m.group(1)

        if '/status' in path:
            pb = db.get_playbook(run_id)
            if not pb:
                return self._json_response({'error': 'Not found'}, 404)
            return self._json_response(pb)

        if '/logs' in path:
            level = params.get('level', ['INFO'])[0]
            logs = db.get_logs(run_id, level=level)
            return self._json_response({'entries': logs, 'total': len(logs)})

        if '/uploads' in path:
            files = db.get_upload_files(run_id)
            return self._json_response(files)

        if '/agent/' in path and '/output' in path:
            am = re.search(r'/agent/(\d+)/output', path)
            if am:
                out = db.get_agent_output(run_id, int(am.group(1)))
                if out:
                    return self._json_response({
                        'has_output': True, 'parsed': out.get('parsed_output'),
                        'raw_length': len(out.get('raw_output', '')),
                        'raw_preview': (out.get('raw_output', '') or '')[:5000]
                    })
            return self._json_response({'has_output': False})

        if '/handoff' in path:
            am = re.search(r'/agent/(\d+)/handoff', path)
            if am:
                h = db.get_handoff(run_id, int(am.group(1)))
                return self._json_response({'handoff': h, 'chars': len(h)})

        return self._json_response({'error': 'Unknown endpoint', 'path': path}, 404)
