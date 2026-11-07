import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
config = {
    "auth": os.getenv("AUTH_API_URL", "http://localhost:8004").rstrip("/"),
    "vehicle": os.getenv("VEHICLE_API_URL", "http://localhost:8001").rstrip("/"),
    "reservation": os.getenv("RESERVATION_API_URL", "http://localhost:8002").rstrip("/"),
    "contract": os.getenv("CONTRACT_API_URL", "http://localhost:8003").rstrip("/"),
}
(ROOT / "config.js").write_text(
    "window.APP_CONFIG = " + json.dumps(config) + ";\n", encoding="utf-8"
)
os.chdir(ROOT)
server = ThreadingHTTPServer(("0.0.0.0", int(os.getenv("PORT", "3000"))), SimpleHTTPRequestHandler)
server.serve_forever()
