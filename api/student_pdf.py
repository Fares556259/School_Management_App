"""Signed internal PDF worker; public requests without server authentication fail closed."""
from http.server import BaseHTTPRequestHandler
import base64, contextlib, hashlib, hmac, importlib.util, json, os, time
from pathlib import Path
import pymupdf as fitz

spec = importlib.util.spec_from_file_location('student_extract', Path(__file__).resolve().parents[1] / 'services/student-pdf-import/extract.py')
extractor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extractor)

def authorized(headers, data):
    secret = os.environ.get('JWT_SECRET', '')
    stamp = headers.get('X-Pdf-Time', '')
    page = headers.get('X-Pdf-Page', '')
    try:
        if not secret or abs(time.time() - int(stamp)) > 60: return False
    except ValueError: return False
    payload = f'pdf-worker-v1:{stamp}:{page}:{hashlib.sha256(data).hexdigest()}'
    expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, headers.get('X-Pdf-Signature', ''))

class handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def respond(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'private, no-store')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 4_000_000: return self.respond(413, {'error': 'PDF too large'})
            data = self.rfile.read(length)
            if not authorized(self.headers, data): return self.respond(403, {'error': 'Unauthorized'})
            page = self.headers.get('X-Pdf-Page', '')
            if page:
                with fitz.open(stream=data, filetype='pdf') as doc:
                    number = int(page)
                    if not 1 <= number <= min(len(doc),50): raise ValueError('Invalid page')
                    image = doc[number-1].get_pixmap(matrix=fitz.Matrix(1.5,1.5)).tobytes('png')
                return self.respond(200, {'image': base64.b64encode(image).decode()})
            with contextlib.redirect_stdout(__import__('sys').stderr): result = extractor.extract(data)
            self.respond(200, {'extraction': result})
        except Exception:
            self.respond(400, {'error': 'PDF extraction failed. No records saved.'})
