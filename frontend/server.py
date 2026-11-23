import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent

# Adresses des API vues par le navigateur. Variable vide = même machine que la page
# (http://<hôte de la page>:<port publié par compose.yaml>) : fonctionne en local
# comme depuis une autre machine (réseau de la salle), sans IP écrite en dur.
PORTS = {
    "auth": ("AUTH_API_URL", 8004),
    "vehicle": ("VEHICLE_API_URL", 8005),
    "reservation": ("RESERVATION_API_URL", 8002),
    "contract": ("CONTRACT_API_URL", 8003),
    "retour_api": ("RETOUR_API_URL", 8006),
    "retour": ("RETOUR_URL", 5173),
    "booking": ("BOOKING_SITE_URL", 3002),
}
explicit = {cle: os.getenv(var, "").rstrip("/") for cle, (var, _) in PORTS.items()}
ports = {cle: port for cle, (_, port) in PORTS.items()}

(ROOT / "config.js").write_text(
    "(function () {\n"
    "  var origine = location.protocol + '//' + location.hostname;\n"
    f"  var explicite = {json.dumps(explicit)};\n"
    f"  var ports = {json.dumps(ports)};\n"
    "  var config = {};\n"
    "  Object.keys(ports).forEach(function (cle) {\n"
    "    config[cle] = explicite[cle] || origine + ':' + ports[cle];\n"
    "  });\n"
    "  window.APP_CONFIG = config;\n"
    "})();\n",
    encoding="utf-8",
)
os.chdir(ROOT)
server = ThreadingHTTPServer(("0.0.0.0", int(os.getenv("PORT", "3000"))), SimpleHTTPRequestHandler)
server.serve_forever()
