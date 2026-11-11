# Fairhours API v1 (read-only) – Schnittstelle Lohnverrechnung / Buchhaltung

Basis-URL: `https://fairhours.malelu.io/api/v1` · Format: JSON (UTF-8) · Zeiten: ISO 8601, Instants in UTC · Stunden: Dezimal (z. B. `7.75`).

## Authentifizierung

Jeder Mandant (Betrieb) erzeugt eigene Schlüssel unter **Admin → Einstellungen → Schnittstelle** (nur Inhaber:innen). Der Schlüssel wird genau einmal angezeigt und nur als Hash gespeichert.

```
Authorization: Bearer zt_live_<prefix>.<secret>
```

Ein Schlüssel trägt **Scopes**; fehlt der Scope für einen Endpunkt, antwortet die API mit `403`. Ohne/mit ungültigem Schlüssel: `401`. Jeder Zugriff aktualisiert `last_used_at`; Widerruf wirkt sofort.

| Scope            | Endpunkte                                      |
| ---------------- | ---------------------------------------------- |
| `read:employees` | `/employees`                                   |
| `read:profiles`  | `/employees/{id}/profile`                      |
| `read:time`      | `/time-entries`, `/absences`                   |
| `read:shifts`    | `/shifts`                                      |
| `read:payroll`   | `/payroll/{year}/{month}`                      |

## Endpunkte

### `GET /employees[?includeInactive=1]`
Stammliste (ohne Lohnverrechnungs-Rollen).
```json
{ "data": [ { "id": "uuid", "personnelNo": "SF-003", "name": "Manuela Behr", "email": "…", "role": "admin", "active": true,
  "weeklyHours": 40, "workDays": [1,2,3,4,5], "recordMode": "full", "gleitzeit": true, "allIn": false,
  "startDate": "2026-01-07", "endDate": null, "vacationDaysPerYear": 25 } ] }
```

### `GET /employees/{id}/profile`
Personalstammdaten aus dem Onboarding-Fragebogen (Person, Kontakt, Bank, Steuer/Familie, Beschäftigung) inkl. Vollständigkeit, Validierungshinweisen und Dokumentliste (nur Metadaten + SHA-256, keine Binärdaten).

### `GET /time-entries?from=YYYY-MM-DD&to=YYYY-MM-DD[&userId=uuid]`
Einzelbuchungen: `startAt/endAt` (UTC), `breakMinutes`, `durationMinutes` (nur bei Dauer-Erfassung), `type` (`work|travel|oncall`), `location` (`office|remote|field`), `projectId`, `source` (`timer|manual|import|correction|plan`), `status`.

### `GET /absences?from&to[&userId]`
Abwesenheiten mit `type` (`vacation|sick|time_comp|special_leave|care_leave|training|unpaid|other`), `halfDay`, `status` (`requested|approved|rejected`).

### `GET /shifts?from&to[&userId]`
Dienstplan (SOLL): `date`, `start`, `end` (lokale Zeit `HH:MM`), `breakMinutes`, `location`, `status` (`draft|published`), `adoptedEntryId` (gesetzt, wenn der Plan als IST übernommen wurde).

### `GET /payroll/{year}/{month}`
Monatswerte je Mitarbeiter:in – dieselben Zahlen wie der XLSX-Lohnexport.
```json
{ "data": [ { "userId": "uuid", "personnelNo": "SF-003", "name": "Manuela Behr",
  "status": "approved", "submittedAt": "…", "approvedAt": "…",
  "hours": { "target": 168, "worked": 171.5, "travel": 3, "credit": 8, "normal": 160, "mehrarbeit": 0,
             "overtime": 3.5, "overtime50": 3.5, "overtime100": 0, "night": 0, "sunday": 0, "holidayWork": 0,
             "timeComp": 0, "balanceStart": 2.25, "balanceEnd": 5.75 },
  "days": { "worked": 21, "holiday": 1, "remoteOnly": 15, "oncall": 0, "vacation": 0, "sick": 1 },
  "byProject": { "VERTRIEB": 120.5, "SHOP": 51 },
  "findings": [ { "code": "DAILY_MAX", "severity": "error", "date": "2026-10-07", "message": "…", "legalRef": "AZG § 9" } ] } ],
  "meta": { "year": 2026, "month": 10, "unit": "decimal hours / days", "generatedAt": "…" } }
```
`status` zeigt den Freigabestand des Monats (`open|submitted|approved|exported|reopened`); für die Abrechnung sollten nur `approved`/`exported` übernommen werden. `findings` listet AZG/ARG-Auffälligkeiten (Fehler/Warnungen), Zuschlagshöhen folgen dem Kollektivvertrag und werden in der Lohnsoftware bewertet.

## Fehler
`400` Parameter fehlen/ungültig · `401` kein/ungültiger Schlüssel · `403` Scope fehlt · `404` unbekannter Endpunkt/Datensatz · Body: `{ "error": "…" }`.

## Beispiel (BMD/DATEV-Import vorbereiten)
```bash
curl -s -H "Authorization: Bearer $ZEITLY_KEY" "https://fairhours.malelu.io/api/v1/payroll/2026/10" | jq '.data[] | {personnelNo, worked: .hours.worked, overtime: .hours.overtime, night: .hours.night}'
```
Alternativ ohne API: **Admin → Export** liefert XLSX (Lohnarten konfigurierbar), CSV und das PDF-Monatsjournal; Versand an die Lohnverrechnung per Knopfdruck.
