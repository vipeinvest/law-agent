#!/usr/bin/env python3
"""Build the MSc study dashboard (index.html) from a JSON export of the study_* tables.

Usage: python3 -I build_dashboard.py data.json index.html
data.json = {"program": {...}, "courses": [...], "deadlines": [...], "todos": [...], "log": [...], "generated_at": "..."}
"""
import json, sys, html, datetime as dt

TZ = dt.timezone(dt.timedelta(hours=2))  # Europe/Vienna (CEST); good enough for display, dates carry their own offset

def esc(s):
    return html.escape(str(s if s is not None else ""))

def parse(ts):
    if not ts:
        return None
    ts = ts.replace("Z", "+00:00")
    try:
        d = dt.datetime.fromisoformat(ts)
    except ValueError:
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return d.astimezone(TZ)

def fmt(ts, with_time=True):
    d = parse(ts)
    if not d:
        return "–"
    return d.strftime("%a %d.%m.%Y %H:%M") if with_time else d.strftime("%d.%m.%Y")

def days_left(ts, now):
    d = parse(ts)
    if not d:
        return None
    return (d.date() - now.date()).days

KIND_LABEL = {"exam": "Prüfung", "payment": "Zahlung", "document": "Unterlage", "application": "Antrag",
              "session": "Session", "assessment": "Abgabe", "deadline": "Frist"}
OWNER_LABEL = {"peter": "Peter", "cody": "Cody (lokal)", "routine": "Routine (Cloud)"}

def build(data):
    now = dt.datetime.now(TZ)
    p = data["program"]
    courses = data.get("courses", [])
    deadlines = sorted([d for d in data.get("deadlines", []) if d.get("status") == "open"], key=lambda d: d["due_at"])
    done_dl = [d for d in data.get("deadlines", []) if d.get("status") != "open"]
    todos = data.get("todos", [])
    log = sorted(data.get("log", []), key=lambda l: l["occurred_at"], reverse=True)
    open_todos = [t for t in todos if t.get("status") == "open"]
    hard_next = [d for d in deadlines if d.get("hard")]

    def dl_row(d):
        n = days_left(d["due_at"], now)
        if n is None:
            cls, lab = "", ""
        elif n < 0:
            cls, lab = "crit", f"{-n} Tage überfällig"
        elif n == 0:
            cls, lab = "crit", "HEUTE"
        elif n == 1:
            cls, lab = "crit", "morgen"
        elif n <= 7:
            cls, lab = "warn", f"in {n} Tagen"
        else:
            cls, lab = "ok", f"in {n} Tagen"
        hard = '<span class="chip hard">hart</span>' if d.get("hard") else ""
        kind = KIND_LABEL.get(d.get("kind"), d.get("kind", ""))
        cal = f' · <a href="https://calendar.google.com/calendar/u/0/r/day/{parse(d["due_at"]).strftime("%Y/%m/%d")}" target="_blank" rel="noopener">Kalender</a>' if parse(d["due_at"]) else ""
        return f'''<li class="dl {cls}">
  <div class="dl-when"><span class="dl-date">{esc(fmt(d["due_at"], d.get("kind") in ("exam","session")))}</span><span class="dl-left">{esc(lab)}</span></div>
  <div class="dl-body"><div class="dl-title">{esc(d["title"])} {hard}<span class="chip">{esc(kind)}</span></div>
  <div class="dl-details">{esc(d.get("details") or "")}<span class="src">Quelle: {esc(d.get("source") or "")}{cal}</span></div></div>
</li>'''

    def todo_row(t):
        due = fmt(t["due_at"], False) if t.get("due_at") else "–"
        pr = {1: "P1", 2: "P2", 3: "P3"}.get(t.get("priority"), "")
        return f'''<li class="todo p{t.get("priority",2)}">
  <span class="todo-owner {esc(t.get("owner"))}">{esc(OWNER_LABEL.get(t.get("owner"), t.get("owner")))}</span>
  <div class="todo-body"><div class="todo-title">{esc(t["title"])} <span class="chip">{pr}</span><span class="chip">bis {esc(due)}</span></div>
  <div class="todo-details">{esc(t.get("details") or "")}</div></div>
</li>'''

    def course_row(c):
        meta = c.get("meta") or {}
        sessions = meta.get("sessions") or []
        sess = "".join(f'<li><b>S{s.get("n")}</b> {esc(s.get("date",""))} · {esc(s.get("topic",""))}{(" · " + esc(s.get("lead"))) if s.get("lead") else ""}</li>' for s in sessions)
        st = {"enrolled": "belegt", "planned": "geplant", "done": "abgeschlossen"}.get(c.get("status"), c.get("status"))
        return f'''<article class="course {esc(c.get("status"))}">
  <header><span class="code">{esc(c["code"])}</span><span class="chip">{esc(c.get("term") or "")}</span><span class="chip">{esc(c.get("ects") or "")} ECTS</span><span class="chip st">{esc(st)}</span></header>
  <h3>{esc(c["title"])}</h3>
  {('<p class="meta">' + esc(c.get("instructor")) + '</p>') if c.get("instructor") else ''}
  {('<p class="meta">' + esc(c.get("schedule")) + '</p>') if c.get("schedule") else ''}
  {('<p>' + esc(c.get("notes")) + '</p>') if c.get("notes") else ''}
  {('<ul class="sessions">' + sess + '</ul>') if sess else ''}
  {('<p class="meta"><a href="' + esc(c.get("platform_url")) + '" target="_blank" rel="noopener">' + esc(c.get("platform")) + ' öffnen</a></p>') if c.get("platform_url") else ''}
</article>'''

    contacts = "".join(
        f'<li><b>{esc(c.get("name") or c.get("role"))}</b><span>{esc(c.get("role"))}</span><span class="mono">{esc(c.get("email") or "")}{(" · " + esc(c.get("phone"))) if c.get("phone") else ""}</span></li>'
        for c in (p.get("contacts") or []))
    urls = p.get("portal_urls") or {}
    links = "".join(f'<a class="portal" href="{esc(v)}" target="_blank" rel="noopener">{esc(k)}</a>'
                    for k, v in urls.items() if isinstance(v, str) and v.startswith("http"))
    logrows = "".join(f'<li><span class="log-date">{esc(fmt(l["occurred_at"], False))}</span><div><b>{esc(l["title"])}</b>{("<br>" + esc(l.get("body"))) if l.get("body") else ""}<span class="src">{esc(l.get("source") or "")} {esc(l.get("source_ref") or "")}</span></div></li>' for l in log[:40])
    structure = (p.get("meta") or {}).get("structure", "")

    next_hard = hard_next[0] if hard_next else None
    hero_next = ""
    if next_hard:
        n = days_left(next_hard["due_at"], now)
        hero_next = f'<div class="hero-next"><span class="eyebrow">Nächste harte Frist</span><strong>{esc(next_hard["title"])}</strong><span>{esc(fmt(next_hard["due_at"]))} · {"heute" if n == 0 else ("morgen" if n == 1 else f"in {n} Tagen")}</span></div>'

    return f'''<title>MSc Blockchain Cockpit</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Source+Sans+3:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/* Layout: one column cockpit, summary first (next hard deadline), then deadlines, todos, courses, programme, contacts, log. */
:root {{
  --bg: #f6f3ee; --surface: #fffdf9; --fg: #1c1a17; --muted: #6b655c; --line: #e3ddd3;
  --accent: #0f5c6e; --accent-fg: #ffffff; --ok: #2f7a4f; --warn: #b36b00; --crit: #b3261e; --crit-bg: #fbe9e7; --warn-bg: #fff4e0; --ok-bg: #e9f4ec;
  --display: "Fraunces", Georgia, "Times New Roman", serif; --body: "Source Sans 3", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; --mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg: #15171a; --surface: #1e2126; --fg: #ece8e1; --muted: #a39d93; --line: #2f333a; --accent: #5fc3d6; --accent-fg: #0d1f24; --ok: #7bd39a; --warn: #f0b24a; --crit: #ff8a80; --crit-bg: #3a1f1d; --warn-bg: #3a2d12; --ok-bg: #1b3324; color-scheme: dark }} }}
:root[data-theme="dark"] {{ --bg: #15171a; --surface: #1e2126; --fg: #ece8e1; --muted: #a39d93; --line: #2f333a; --accent: #5fc3d6; --accent-fg: #0d1f24; --ok: #7bd39a; --warn: #f0b24a; --crit: #ff8a80; --crit-bg: #3a1f1d; --warn-bg: #3a2d12; --ok-bg: #1b3324; color-scheme: dark }}
* {{ box-sizing: border-box }}
body {{ background: var(--bg); color: var(--fg); font-family: var(--body); font-size: 16px; line-height: 1.5; padding-inline: 16px; padding-block: 8px 48px; max-width: 1080px; margin-inline: auto }}
h1, h2, h3 {{ font-family: var(--display); text-wrap: balance; margin: 0 }}
h1 {{ font-size: clamp(1.6rem, 4vw, 2.4rem); font-weight: 700; line-height: 1.1 }}
h2 {{ font-size: 1.25rem; font-weight: 700; margin-block: 0 12px; display: flex; align-items: baseline; gap: 10px }}
h2 small {{ font-family: var(--body); font-weight: 400; color: var(--muted); font-size: .85rem }}
h3 {{ font-size: 1.1rem; font-weight: 600 }}
a {{ color: var(--accent) }}
.eyebrow {{ font-size: .72rem; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 600 }}
.hero {{ display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: end; padding-block: 18px 14px; border-bottom: 2px solid var(--fg) }}
.hero .sub {{ color: var(--muted); margin-top: 4px }}
.hero-next {{ background: var(--accent); color: var(--accent-fg); padding: 12px 16px; border-radius: 10px; display: grid; gap: 2px; min-width: 0 }}
.hero-next .eyebrow {{ color: var(--accent-fg); opacity: .8 }}
.hero-next strong {{ font-family: var(--display); font-size: 1.05rem }}
.kpis {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-block: 16px }}
.kpi {{ background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px }}
.kpi b {{ font-family: var(--display); font-size: 1.6rem; display: block; font-variant-numeric: tabular-nums }}
.kpi span {{ color: var(--muted); font-size: .85rem }}
section {{ margin-block: 28px }}
ul {{ list-style: none; margin: 0; padding: 0 }}
.dl {{ display: grid; grid-template-columns: 150px 1fr; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line) }}
.dl:last-child {{ border-bottom: 1px solid var(--line) }}
.dl-when {{ display: grid; align-content: start; gap: 2px }}
.dl-date {{ font-family: var(--mono); font-size: .85rem; font-variant-numeric: tabular-nums }}
.dl-left {{ font-size: .8rem; font-weight: 700; padding: 1px 8px; border-radius: 99px; width: max-content; background: var(--ok-bg); color: var(--ok) }}
.dl.warn .dl-left {{ background: var(--warn-bg); color: var(--warn) }}
.dl.crit .dl-left {{ background: var(--crit-bg); color: var(--crit) }}
.dl.crit {{ border-left: 4px solid var(--crit); padding-left: 10px }}
.dl.warn {{ border-left: 4px solid var(--warn); padding-left: 10px }}
.dl-body {{ min-width: 0 }}
.dl-title {{ font-weight: 700 }}
.dl-details {{ color: var(--muted); font-size: .92rem; white-space: pre-line }}
.src {{ display: block; font-size: .78rem; color: var(--muted); margin-top: 4px }}
.chip {{ display: inline-block; font-size: .72rem; font-weight: 600; letter-spacing: .03em; padding: 1px 8px; border: 1px solid var(--line); border-radius: 99px; margin-left: 6px; color: var(--muted); vertical-align: middle }}
.chip.hard {{ border-color: var(--crit); color: var(--crit) }}
.chip.st {{ border-color: var(--accent); color: var(--accent) }}
.todo {{ display: grid; grid-template-columns: 120px 1fr; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line) }}
.todo:last-child {{ border-bottom: 1px solid var(--line) }}
.todo-owner {{ font-size: .78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); padding-top: 3px }}
.todo-owner.peter {{ color: var(--crit) }}
.todo-owner.cody {{ color: var(--accent) }}
.todo-title {{ font-weight: 600 }}
.todo-details {{ color: var(--muted); font-size: .92rem }}
.courses {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px }}
.course {{ background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; min-width: 0 }}
.course.planned {{ opacity: .85; border-style: dashed }}
.course header {{ display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: 6px }}
.code {{ font-family: var(--mono); font-weight: 600; font-size: .85rem; color: var(--accent) }}
.course .meta {{ color: var(--muted); font-size: .9rem; margin: 4px 0 }}
.course p {{ margin: 6px 0; font-size: .95rem }}
.sessions li {{ font-size: .9rem; padding: 2px 0; border-top: 1px dotted var(--line) }}
.programme {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px }}
.sem {{ background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px }}
.sem .eyebrow {{ display: block; margin-bottom: 4px }}
.sem ul li {{ padding: 3px 0; border-top: 1px dotted var(--line); font-size: .93rem }}
.portals {{ display: flex; flex-wrap: wrap; gap: 8px }}
.portal {{ padding: 6px 12px; border: 1px solid var(--accent); border-radius: 99px; text-decoration: none; font-weight: 600; font-size: .9rem }}
.contacts {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px }}
.contacts li {{ background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; display: grid; gap: 1px; min-width: 0 }}
.contacts span {{ font-size: .85rem; color: var(--muted); overflow-wrap: anywhere }}
.mono {{ font-family: var(--mono); font-size: .8rem !important; color: var(--fg) !important }}
.log li {{ display: grid; grid-template-columns: 95px 1fr; gap: 10px; padding: 8px 0; border-top: 1px solid var(--line); font-size: .92rem }}
.log-date {{ font-family: var(--mono); font-size: .8rem; color: var(--muted) }}
.note {{ background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; font-size: .92rem; color: var(--muted) }}
footer {{ margin-top: 36px; color: var(--muted); font-size: .8rem; border-top: 1px solid var(--line); padding-top: 10px }}
@media (max-width: 560px) {{ .hero {{ grid-template-columns: 1fr }} .dl, .todo, .log li {{ grid-template-columns: 1fr; gap: 4px }} }}
@media (prefers-reduced-motion: no-preference) {{ .hero-next {{ transition: transform .2s }} }}
</style>
<header class="hero">
  <div>
    <span class="eyebrow">{esc(p.get("institution"))}</span>
    <h1>{esc(p.get("name"))}</h1>
    <div class="sub">{esc(p.get("degree"))} · {esc(p.get("mode"))} · {esc(p.get("intake"))} · Status: <b>{esc(p.get("status"))}</b> · Application No. <span class="mono">{esc(p.get("application_no"))}</span></div>
  </div>
  {hero_next}
</header>
<div class="kpis">
  <div class="kpi"><b>{len([d for d in deadlines if (days_left(d["due_at"], now) or 99) <= 7])}</b><span>Fristen in 7 Tagen</span></div>
  <div class="kpi"><b>{len(hard_next)}</b><span>harte Fristen offen</span></div>
  <div class="kpi"><b>{len([t for t in open_todos if t.get("owner") == "peter"])}</b><span>Todos bei Peter</span></div>
  <div class="kpi"><b>{len([c for c in courses if c.get("status") == "enrolled"])}/{len(courses)}</b><span>Kurse belegt / geplant</span></div>
  <div class="kpi"><b>{sum(float(c.get("ects") or 0) for c in courses if c.get("status") == "done"):.0f}/90</b><span>ECTS abgeschlossen</span></div>
</div>

<section id="fristen">
  <h2>Fristen &amp; Termine <small>{len(deadlines)} offen · alle im Google-Kalender mit Alarm</small></h2>
  <ul>{"".join(dl_row(d) for d in deadlines)}</ul>
  {('<p class="note">Erledigt: ' + ", ".join(esc(d["title"]) for d in done_dl) + '</p>') if done_dl else ''}
</section>

<section id="todos">
  <h2>Todos <small>{len(open_todos)} offen · Peter = dein Handgriff, Cody = dein PC, Routine = Cloud</small></h2>
  <ul>{"".join(todo_row(t) for t in sorted(open_todos, key=lambda t: (t.get("priority", 2), t.get("due_at") or "9")))}</ul>
</section>

<section id="kurse">
  <h2>Kurse</h2>
  <div class="courses">{"".join(course_row(c) for c in courses)}</div>
</section>

<section id="programm">
  <h2>Studienablauf <small>90 ECTS · 3 Semester · Distance Learning</small></h2>
  <div class="programme">
    <div class="sem"><span class="eyebrow">Semester 1 · Fall 2026 (seit 28.09.2026)</span><ul><li><b>BLOC-511DL Digital Currency</b> · 10 ECTS · läuft (MOOC-Format, wöchentliche Live Q&amp;A, MSc-Level-Assessment)</li><li>+ 2 weitere Pflichtkurse · je 10 ECTS (Belegung über Portal-Pre-Registration)</li></ul></div>
    <div class="sem"><span class="eyebrow">Semester 2 · Spring 2027</span><ul><li>3 Pflichtkurse · je 10 ECTS</li><li>Pflichtkurse insgesamt (Sem. 1+2): BLOC-512DL Blockchain Systems and Architectures · BLOC-513DL Law and Regulation in Blockchain · BLOC-514DL Emerging Topics · 2 weitere laut Kurskatalog</li></ul></div>
    <div class="sem"><span class="eyebrow">Semester 3 · Fall 2027</span><ul><li>3 Wahlkurse · je 10 ECTS (z. B. BLOC-521DL Digital Currency Programming, BLOC-522DL Smart Contract Programming, BLOC-523DL Permissioned Blockchains Programming)</li><li><b>oder</b> Master Thesis BLOC-551DL · 30 ECTS · Thesis-Entscheidung + Thema bis Sommer 2027</li></ul></div>
    <div class="sem"><span class="eyebrow">Prüfungen &amp; Noten</span><ul><li>Pro Kurs: Assignments/Assessments auf Blackboard + Abschlussprüfung (Format je Kurs, Details nach Blackboard-Scan)</li><li>BLOC-511DL: MSc-Level-Assessment für die 10 ECTS; MOOC-Assessments ungraded bis 31.05.2027</li><li>Mindest-CPA 2.0 für den Abschluss</li><li>Zahlung pro Kurs (1.850 € je Kurs), Ratenplan, 7,5 % Rabatt bei Vorauszahlung, BTC möglich</li></ul></div>
  </div>
  <p class="note">{esc(structure)} · Offizielle Kursliste und Prüfungsformate werden nach dem Blackboard-/Portal-Scan durch Cody ergänzt (Programmseite ist aus der Cloud nicht erreichbar).</p>
</section>

<section id="zugaenge">
  <h2>Portale</h2>
  <div class="portals">{links}</div>
  <p class="note">Zugangsdaten stehen nicht hier: NEPTON-Login in der UNIC-Mail vom 13.10. und im Kalendertermin; temporäre Portal-Zugangsdaten in der DCURR-Mail (donotreply@unic.ac.cy). Studenten-Mail: <span class="mono">{esc(p.get("student_email"))}</span></p>
</section>

<section id="kontakte">
  <h2>Kontakte UNIC</h2>
  <ul class="contacts">{contacts}</ul>
</section>

<section id="log">
  <h2>Verlauf <small>Mails &amp; Scans, neueste zuerst</small></h2>
  <ul class="log">{logrows}</ul>
</section>

<footer>Stand {esc(now.strftime("%d.%m.%Y %H:%M"))} Wien · Quelle: Supabase study_* (Programm {esc(p.get("slug"))}) · aktualisiert täglich 06:50 durch die Routine „MSc-Studium-Wächter" und nach jedem Blackboard-Scan.</footer>
'''

if __name__ == "__main__":
    data = json.load(open(sys.argv[1], encoding="utf-8"))
    open(sys.argv[2], "w", encoding="utf-8").write(build(data))
    print("written", sys.argv[2])
