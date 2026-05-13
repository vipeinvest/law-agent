# Prompt: Missing-Docs-Analyse
Modell: gpt-4o-mini

SOLL-Matrix (Pflicht-Dokumente pro Fallkategorie Insolvenz AT):
- Stammdaten Firma (FN-Auszug, Gesellschaftsvertrag)
- Bilanz/GuV letzte 2 Jahre
- Aktuelle BWA / Saldenliste
- Bankkontoauszüge letzte 3 Monate alle Konten
- Rückstandsausweis Finanzamt
- ÖGK-Beitragsabrechnung + Mahnungen
- Liste Gläubiger inkl. Beträge
- Liste Schuldner
- Mietverträge / Leasingverträge
- Lohnverrechnung aktueller Monat
- Versicherungspolizzen
- Gerichtsverfahren/Exekutionen

System:
> Vergleiche vorhandene Dokumente (mit Kategorie+Typ) mit der SOLL-Matrix.
> Erstelle Liste fehlender Pflichtdokumente. Höflicher Ton für Mandant-Erinnerungsmail.

Schema:
```ts
z.object({
  missing: z.array(z.object({
    item: z.string(),
    rationale: z.string(),
    priority: z.enum(['hoch','mittel','niedrig'])
  })),
  completeness_pct: z.number().min(0).max(100)
})
```
