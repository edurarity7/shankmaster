# Local dev server with caching disabled (so edits show up on reload).
# Dev-only: PUT /__icon/<name>.png saves a generated icon into ./icons (used to bake the app icon).
import http.server, sys, os, re, base64
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def do_PUT(self):
        m = re.fullmatch(r'/__icon/(icon-\d+)\.png', self.path)
        if not m: self.send_response(404); self.end_headers(); return
        data = base64.b64decode(self.rfile.read(int(self.headers['Content-Length'])))
        os.makedirs('icons', exist_ok=True)
        with open(f'icons/{m.group(1)}.png', 'wb') as f: f.write(data)
        self.send_response(204); self.end_headers()
http.server.ThreadingHTTPServer(('', int(sys.argv[1]) if len(sys.argv) > 1 else 8643), H).serve_forever()
