import type { Metadata } from 'next';
import { env } from '@/lib/env';

export const metadata: Metadata = { title: 'Impressum' };

export default function ImpressumPage() {
  return (
    <>
      <h1>Impressum</h1>
      <p>Informationspflicht laut § 5 ECG und § 25 MedienG.</p>
      <p>
        <strong>{env.operatorName}</strong>
        <br />
        {env.operatorAddress}
        <br />
        E-Mail: <a href={`mailto:${env.operatorEmail}`}>{env.operatorEmail}</a>
        <br />
        Web: <a href="https://www.malelu.io">www.malelu.io</a>
      </p>
      <p>Unternehmensgegenstand: Entwicklung und Betrieb von Software (KI- und Automatisierungslösungen). Mitglied der Wirtschaftskammer Salzburg. Anwendbare Rechtsvorschriften: Gewerbeordnung (ris.bka.gv.at). [UID-Nummer / Gewerbebehörde bitte ergänzen]</p>
      <h2>Verantwortung für Inhalte und Daten</h2>
      <p>Zeitly ist ein Werkzeug zur Arbeitszeiterfassung. Verantwortlich für die Einhaltung des Arbeitszeitgesetzes und für die Richtigkeit der erfassten Daten ist der jeweilige Arbeitgeber. Zeitly unterstützt mit Prüfregeln und Auswertungen, ersetzt aber keine arbeitsrechtliche Beratung.</p>
      <h2>Streitschlichtung</h2>
      <p>
        Verbraucher haben die Möglichkeit, Beschwerden an die Online-Streitbeilegungsplattform der EU zu richten: <a href="https://ec.europa.eu/odr">ec.europa.eu/odr</a>. Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
      </p>
      <h2>Haftung für Links</h2>
      <p>Für Inhalte verlinkter Seiten sind ausschließlich deren Betreiber verantwortlich.</p>
      <p className="text-sm text-muted">
        Version {env.version}
        {env.buildSha ? ` · ${env.buildSha.slice(0, 7)}` : ''}
      </p>
    </>
  );
}
