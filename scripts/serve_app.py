#!/usr/bin/env python3
import os
import sys
from http.server import SimpleHTTPRequestHandler
import socketserver

class ThreadedHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

class CleanHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable caching so developer always sees latest JS/CSS/HTML
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    os.chdir(root_dir)
    server = ThreadedHTTPServer(('0.0.0.0', port), CleanHandler)
    print(f"FarmIntel Server active at http://localhost:{port}/ and http://127.0.0.1:{port}/")
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        server.server_close()

if __name__ == '__main__':
    main()
