# Keynote Jacket — One-Page-Shop

Eigenständiges Nebenprojekt, hat mit dem Law-Agent-Code nichts zu tun (kein Build, keine Abhängigkeiten).
Vor dem Launch am besten in ein eigenes Repo verschieben.

| Datei | Zweck |
|---|---|
| `index.html` | Die komplette Verkaufsseite (statisch, überall hostbar) |
| `supabase.sql` | Wartelisten-Tabelle inkl. Referral-Codes, nur Insert für anonyme Besucher |
| `marketing/PLAYBOOK.md` | Launch-Plan, fertige Posts, Guerilla-Ideen, Ads-Phase, Sourcing, Kalkulation |

## In Betrieb nehmen

1. **Warteliste:** Supabase-Projekt anlegen, `supabase.sql` ausführen, URL + Publishable Key in `CONFIG` (unten in `index.html`) eintragen.
2. **Checkout:** In Stripe ein Produkt + Payment Link anlegen (Größe als Pflichtfeld, Lieferadresse abfragen), Link in `CONFIG.checkoutUrl`. Solange leer, führen alle Kauf-Buttons zur Warteliste.
3. **Hosting:** Ordner auf Cloudflare Pages / Netlify / Vercel ziehen, Domain verbinden.
4. **Double Opt-in:** Bestätigungsmail über das Mail-Tool (Brevo, Klaviyo, MailerLite) verschicken, erst danach `confirmed = true`.

## Vor dem ersten Euro Umsatz (Pflicht)

- [ ] Impressum im Footer ausfüllen, Datenschutzerklärung + AGB + Widerrufsbelehrung verlinken
- [ ] Lieferant fix, Muster in der Hand, **echte Produktfotos** statt der SVG-Platzhaltergrafik
- [ ] Materialangaben auf der Seite stimmen mit dem Muster überein (Lammleder, Futter)
- [ ] Lieferzeit in `CONFIG.leadTime` ist realistisch (Produktion + Versand + Puffer)
- [ ] `CONFIG.batchSize` ist die echte Obergrenze — keine erfundene Verknappung

## Rote Linien (nicht verhandelbar, sonst Abmahnung/Shop-Sperre)

- **Nicht „das Original" behaupten.** Das Original wurde im Juli 2026 für 960.000 $ versteigert. „Inspiriert von" ist erlaubt und ohnehin der bessere Witz.
- **Kein Name/Bild von Jensen Huang als Werbeträger**, keine Nvidia- oder Tom-Ford-Logos, kein „Tom Ford Style" im Produktnamen. Namensnennung nur im Disclaimer.
- **Witze über die Jacke, nicht über die Vorwürfe.** Unbewiesene Behauptungen über eine reale Person zu wiederholen ist Haftungsrisiko und killt Ad-Accounts.
- **Keine gescrapten E-Mail-Adressen anschreiben.** In AT/DE ohne Einwilligung unzulässig (TKG § 174, UWG § 7, DSGVO). Ersatz: Opt-in-Warteliste mit Referral-Schleife, siehe Playbook.
