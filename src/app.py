"""MODE — Multiomics Decision Engine — Flask App Entry Point"""

import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

os.makedirs(os.getenv('UPLOAD_DIR', './uploads'), exist_ok=True)
os.makedirs(os.getenv('EXPORT_DIR', './exports'), exist_ok=True)

from routes.api import api_bp
app.register_blueprint(api_bp, url_prefix='/api')

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('FLASK_PORT', 5000)),
        debug=False
    )
