import uuid
from datetime import datetime

class LogStore:
    def __init__(self, run_id):
        self.run_id = run_id
        self.entries = []
    def add(self, level, category, event, message, data=None, agent=None):
        entry = {'id': str(uuid.uuid4())[:8], 'timestamp': datetime.now().isoformat(),
                 'level': level, 'category': category, 'event': event,
                 'message': message, 'data': data or {},
                 'agent': agent or (data.get('agent') if data else None), 'run_id': self.run_id}
        self.entries.append(entry)
        return entry
    def get_filtered(self, level='INFO', agent=None, search=None):
        levels = ['TRACE','DEBUG','INFO','WARN','ERROR','FATAL']
        min_idx = levels.index(level) if level in levels else 0
        r = [e for e in self.entries if levels.index(e['level']) >= min_idx]
        if agent: r = [e for e in r if e.get('agent') == agent]
        if search: r = [e for e in r if search.lower() in e['message'].lower()]
        return r
    def get_errors(self): return [e for e in self.entries if e['level'] in ('ERROR','FATAL')]
    def export_json(self): return self.entries
