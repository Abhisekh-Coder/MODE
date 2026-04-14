"""Vercel Serverless Function — wraps the Flask app as a single handler."""

import sys
import os
from pathlib import Path

# Add src/ to path so imports work
src_dir = str(Path(__file__).parent.parent / 'src')
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

# Set working directory for prompt file resolution
os.chdir(str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

os.makedirs(os.getenv('UPLOAD_DIR', './uploads'), exist_ok=True)
os.makedirs(os.getenv('EXPORT_DIR', './exports'), exist_ok=True)

from routes.api import api_bp
app.register_blueprint(api_bp, url_prefix='/api')

# Health check
@app.route('/api/health')
def health():
    return {'status': 'ok', 'service': 'mode-backend'}
