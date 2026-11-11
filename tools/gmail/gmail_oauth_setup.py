#!/usr/bin/env python3
"""Einmalig auf Peters PC ausführen: holt ein Gmail-Refresh-Token für office@malelu.io.

    python3 gmail_oauth_setup.py client_secret_XXXX.json

Nur Standardbibliothek, keine Installation nötig. Öffnet den Browser, nach dem Login
druckt das Skript die drei Werte, die in die Cloud-Umgebung als Secrets gehören:
GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN.
"""
import json, sys, urllib.parse, urllib.request, webbrowser, secrets
from http.server import HTTPServer, BaseHTTPRequestHandler

SCOPE = "https://www.googleapis.com/auth/gmail.send"
PORT = 8765

if len(sys.argv) < 2:
    sys.exit("Aufruf: python3 gmail_oauth_setup.py client_secret.json")
cfg = json.load(open(sys.argv[1], encoding="utf-8"))
cfg = cfg.get("installed") or cfg.get("web") or cfg
client_id, client_secret = cfg["client_id"], cfg["client_secret"]
redirect = f"http://localhost:{PORT}/"
state = secrets.token_urlsafe(16)

auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
    "client_id": client_id, "redirect_uri": redirect, "response_type": "code",
    "scope": SCOPE, "access_type": "offline", "prompt": "consent", "state": state,
    "login_hint": "office@malelu.io",
})

code_box = {}
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if q.get("state", [""])[0] != state or "code" not in q:
            self.send_response(400); self.end_headers(); self.wfile.write(b"Fehler: kein Code"); return
        code_box["code"] = q["code"][0]
        self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.end_headers()
        self.wfile.write("<h2>Fertig. Dieses Fenster kann geschlossen werden.</h2>".encode())
    def log_message(self, *a): pass

print("Browser öffnet sich. Bitte mit office@malelu.io anmelden und Zugriff erlauben.")
print("Falls nichts aufgeht, diese URL manuell öffnen:\n", auth_url)
webbrowser.open(auth_url)
srv = HTTPServer(("localhost", PORT), H)
while "code" not in code_box:
    srv.handle_request()

data = urllib.parse.urlencode({
    "code": code_box["code"], "client_id": client_id, "client_secret": client_secret,
    "redirect_uri": redirect, "grant_type": "authorization_code",
}).encode()
tok = json.load(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=data)))
if "refresh_token" not in tok:
    sys.exit("Kein refresh_token erhalten. Bitte unter https://myaccount.google.com/permissions den Zugriff der App entfernen und erneut ausführen.")
print("\nDiese drei Werte in der Cloud-Umgebung als Secrets eintragen (nicht in den Chat!):\n")
print("GMAIL_CLIENT_ID=" + client_id)
print("GMAIL_CLIENT_SECRET=" + client_secret)
print("GMAIL_REFRESH_TOKEN=" + tok["refresh_token"])
