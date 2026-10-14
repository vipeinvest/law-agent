#!/usr/bin/env python3
"""Mail mit Anhängen über die Gmail API senden (Cloud-Seite), mit SHA-256-Verifikation.

Secrets aus der Umgebung: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN.

    python3 gmail_send.py --to m.behr@steinerfood.com --cc office@malelu.io \
        --subject "Betreff" --body body.txt --attach datei.pdf [--attach weitere.docx] \
        [--reply-to-message-id <gmail id> --thread-id <gmail thread id>]

Druckt die Gmail-Message-ID und prüft danach jeden Anhang der gesendeten Nachricht
gegen die lokale Datei (SHA-256). Exit-Code 0 nur, wenn alles übereinstimmt.
"""
import argparse, base64, hashlib, json, mimetypes, os, sys, urllib.parse, urllib.request
from email.message import EmailMessage
from email.utils import formataddr

API = "https://gmail.googleapis.com/gmail/v1/users/me"

def access_token():
    cid, sec, rt = (os.environ.get(k) for k in ("GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"))
    if not (cid and sec and rt):
        sys.exit("Secrets GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN fehlen in der Umgebung.")
    data = urllib.parse.urlencode({"client_id": cid, "client_secret": sec, "refresh_token": rt, "grant_type": "refresh_token"}).encode()
    return json.load(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=data)))["access_token"]

def call(tok, path, data=None, params=None):
    url = API + path + ("?" + urllib.parse.urlencode(params) if params else "")
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req))

def sha(b): return hashlib.sha256(b).hexdigest()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--to", action="append", required=True); ap.add_argument("--cc", action="append", default=[])
    ap.add_argument("--bcc", action="append", default=[]); ap.add_argument("--subject", required=True)
    ap.add_argument("--body", required=True, help="Datei mit Klartext-Body"); ap.add_argument("--attach", action="append", default=[])
    ap.add_argument("--from-name", default="MALELU .io"); ap.add_argument("--from-addr", default="office@malelu.io")
    ap.add_argument("--reply-to-message-id"); ap.add_argument("--thread-id"); ap.add_argument("--in-reply-to-header")
    a = ap.parse_args()

    msg = EmailMessage()
    msg["From"] = formataddr((a.from_name, a.from_addr)); msg["To"] = ", ".join(a.to)
    if a.cc: msg["Cc"] = ", ".join(a.cc)
    if a.bcc: msg["Bcc"] = ", ".join(a.bcc)
    msg["Subject"] = a.subject
    if a.in_reply_to_header:
        msg["In-Reply-To"] = a.in_reply_to_header; msg["References"] = a.in_reply_to_header
    msg.set_content(open(a.body, encoding="utf-8").read())
    local = {}
    for p in a.attach:
        raw = open(p, "rb").read(); name = os.path.basename(p); local[name] = sha(raw)
        mt, _ = mimetypes.guess_type(p); mt = mt or "application/octet-stream"; m, s = mt.split("/", 1)
        msg.add_attachment(raw, maintype=m, subtype=s, filename=name)

    tok = access_token()
    payload = {"raw": base64.urlsafe_b64encode(msg.as_bytes()).decode()}
    if a.thread_id: payload["threadId"] = a.thread_id
    sent = call(tok, "/messages/send", payload)
    mid = sent["id"]; print("gmail_message_id", mid, "thread_id", sent.get("threadId"))

    # Verifikation: jeden Anhang der gesendeten Nachricht laden und Hash vergleichen
    full = call(tok, f"/messages/{mid}", params={"format": "full"})
    ok = True; seen = set()
    def walk(part):
        nonlocal ok
        fn = part.get("filename"); body = part.get("body", {})
        if fn and body.get("attachmentId"):
            att = call(tok, f"/messages/{mid}/attachments/{body['attachmentId']}")
            data = base64.urlsafe_b64decode(att["data"] + "==")
            h = sha(data); seen.add(fn)
            match = local.get(fn) == h
            ok &= match
            print(("OK  " if match else "FEHLER ") + fn, h, len(data), "bytes")
        for sp in part.get("parts", []) or []: walk(sp)
    walk(full["payload"])
    missing = set(local) - seen
    if missing: ok = False; print("FEHLT in gesendeter Mail:", ", ".join(sorted(missing)))
    print("VERIFIKATION", "OK" if ok else "FEHLGESCHLAGEN")
    sys.exit(0 if ok else 2)

if __name__ == "__main__":
    main()
