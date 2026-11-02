import type { Metadata } from 'next';
import { env } from '@/lib/env';

export const metadata: Metadata = { title: 'Datenschutz' };

export default function DatenschutzPage() {
  return (
    <>
      <h1>Datenschutzinformation</h1>
      <p>
        Diese Anwendung („Zeitly“) wird von <strong>{env.operatorName}</strong>, {env.operatorAddress}, E-Mail <a href={`mailto:${env.operatorEmail}`}>{env.operatorEmail}</a>, als <strong>Auftragsverarbeiter</strong> betrieben. <strong>Verantwortlicher</strong> im Sinne der DSGVO für die Verarbeitung der Arbeitszeitdaten ist der jeweilige Arbeitgeber (der Betrieb, der Sie zur Nutzung eingeladen hat). Ihre vollständige Datenschutzinformation nach Art. 13 DSGVO erhalten Sie von Ihrem Arbeitgeber; diese Seite fasst zusammen, was in der App passiert.
      </p>
      <h2>Welche Daten verarbeitet werden</h2>
      <ul>
        <li>Stammdaten: Name, dienstliche E-Mail-Adresse, Personalnummer, Rolle, Vertragsdaten (Wochenstunden, Arbeitstage, Gleitzeit, Urlaubsanspruch, Ein-/Austritt, Zeitkonto-Saldo).</li>
        <li>Arbeitszeitaufzeichnungen (§ 26 AZG): Datum, Beginn, Ende, Pausen bzw. Dauer, Art (Arbeit, Reisezeit, Rufbereitschaft), Arbeitsort-Kategorie (Büro, Telearbeit, Außendienst), Projekt-/Kostenstellenzuordnung, freiwillige Notizen.</li>
        <li>Abwesenheiten: Urlaub, Zeitausgleich, Krankenstand (nur Tatsache und Dauer, keine Diagnose), Pflegefreistellung, Sonderurlaub, Fortbildung, unbezahlte Zeiten.</li>
        <li>Monatsabschluss-Bestätigungen (Zeitpunkt, IP-Adresse), Anmeldeprotokoll (Zeitpunkt, IP-Adresse, Browser), Änderungsprotokoll (wer hat wann was geändert).</li>
      </ul>
      <p>
        <strong>Nicht</strong> verarbeitet werden: GPS- oder Standortdaten, Bildschirmaufnahmen, Tastatur- oder Aktivitätsmessungen, private Inhalte.
      </p>
      <h2>Zwecke und Rechtsgrundlagen</h2>
      <ul>
        <li>Erfüllung der gesetzlichen Aufzeichnungspflicht und Einhaltung der Höchstgrenzen und Ruhezeiten (AZG §§ 9, 11, 12, 26; ARG) – Art. 6 Abs 1 lit c DSGVO.</li>
        <li>Entgeltabrechnung, Zeitkonto, Urlaubsverwaltung – Art. 6 Abs 1 lit b und c DSGVO (Arbeitsvertrag, § 76 EStG, UrlG).</li>
        <li>Krankenstand als Abwesenheitsgrund – Art. 9 Abs 2 lit b DSGVO iVm arbeitsrechtlichen Pflichten.</li>
        <li>Projekt- und Kostenstellenauswertung, IT-Sicherheit, Nachvollziehbarkeit von Änderungen – Art. 6 Abs 1 lit f DSGVO (berechtigtes Interesse).</li>
      </ul>
      <h2>Wer Ihre Daten sieht</h2>
      <p>Sie selbst sehen nur Ihre eigenen Daten. Ihre Führungskraft sieht die Daten ihres Teams, Administrator:innen des Betriebs alle Mitarbeiter:innen, die Rolle „Lohnverrechnung“ nur Monatsauswertungen und Exporte. Der Betreiber greift nur für Wartung und Support auf Daten zu und ist durch einen Auftragsverarbeitungsvertrag (Art. 28 DSGVO) gebunden.</p>
      <h2>Empfänger und Hosting</h2>
      <table>
        <thead>
          <tr>
            <th>Dienstleister</th>
            <th>Zweck</th>
            <th>Standort</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Hostinger International Ltd.</td>
            <td>Server (Anwendung)</td>
            <td>Frankfurt, Deutschland</td>
          </tr>
          <tr>
            <td>Supabase Inc.</td>
            <td>Datenbank</td>
            <td>AWS eu-west-1 (Irland), EU</td>
          </tr>
          <tr>
            <td>Cloudflare Inc.</td>
            <td>DNS, TLS, Schutz vor Angriffen</td>
            <td>EU-Standorte; US-Unternehmen (EU-US Data Privacy Framework)</td>
          </tr>
          <tr>
            <td>Resend Inc.</td>
            <td>Transaktions-E-Mails (Anmeldecodes, Benachrichtigungen, Exporte)</td>
            <td>USA (Standardvertragsklauseln)</td>
          </tr>
        </tbody>
      </table>
      <h2>Speicherdauer</h2>
      <ul>
        <li>Arbeitszeitaufzeichnungen und Abrechnungsgrundlagen: 7 Jahre (§ 132 BAO), danach Löschung bzw. Anonymisierung.</li>
        <li>Anmeldecodes: 24 Stunden. Anmeldeprotokoll: 90 Tage. Sitzungen: 30 Tage nach letzter Nutzung.</li>
        <li>Änderungsprotokoll: solange die zugehörigen Daten gespeichert sind. Backups: 30 Tage (verschlüsselt, EU).</li>
      </ul>
      <h2>Ihre Rechte</h2>
      <p>
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung (soweit keine Aufbewahrungspflicht besteht), Einschränkung, Datenübertragbarkeit und Widerspruch. Ihre Aufzeichnungen können Sie jederzeit selbst unter „Profil“ herunterladen (§ 26 Abs 8 AZG, Art. 15/20 DSGVO). Beschwerden richten Sie an Ihren Arbeitgeber oder an die österreichische Datenschutzbehörde, Barichgasse 40–42, 1030 Wien, <a href="https://www.dsb.gv.at">dsb.gv.at</a>.
      </p>
      <h2>Cookies und lokale Speicherung</h2>
      <p>Zeitly verwendet ausschließlich ein technisch notwendiges Sitzungs-Cookie (Anmeldung) sowie lokalen Speicher im Browser für die Offline-Funktion der Stempeluhr (Buchungen werden zwischengespeichert, bis wieder Verbindung besteht). Es gibt kein Tracking, keine Werbung und keine Analyse-Cookies.</p>
      <p className="text-muted text-sm">Stand: {new Date().toLocaleDateString('de-AT', { month: 'long', year: 'numeric' })}</p>
    </>
  );
}
