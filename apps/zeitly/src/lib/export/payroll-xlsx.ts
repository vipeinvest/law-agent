import 'server-only';
import ExcelJS from 'exceljs';
import type { OrgRow } from '../org';
import { ABSENCE_LABELS, fmtDate, fmtDateTime, fmtMonth, LOCATION_LABELS, PERIOD_LABELS, TYPE_LABELS } from '../format';
import { hoursDecimal, projectLabel, type OrgMonth } from './common';
import { formatMinutes } from '@/domain/time';

/** Default wage-type codes – adjustable per organisation in settings.payrollCodes. */
export const DEFAULT_PAYROLL_CODES: Record<string, { code: string; label: string; unit: 'h' | 'd' }> = {
  normal: { code: '1000', label: 'Normalstunden', unit: 'h' },
  mehrarbeit: { code: '1050', label: 'Mehrarbeit (Teilzeit)', unit: 'h' },
  ot50: { code: '1100', label: 'Überstunden 50 %', unit: 'h' },
  ot100: { code: '1200', label: 'Überstunden 100 % (Nacht/So/Feiertag)', unit: 'h' },
  travel: { code: '1300', label: 'Reisezeit', unit: 'h' },
  night: { code: '1400', label: 'Nachtstunden (Zuschlagsbasis)', unit: 'h' },
  sunday: { code: '1410', label: 'Sonntagsstunden (Zuschlagsbasis)', unit: 'h' },
  holidayWork: { code: '1420', label: 'Feiertagsarbeit (Zuschlagsbasis)', unit: 'h' },
  vacation: { code: '2000', label: 'Urlaub', unit: 'd' },
  sick: { code: '2100', label: 'Krankenstand', unit: 'd' },
  time_comp: { code: '2200', label: 'Zeitausgleich', unit: 'd' },
  care_leave: { code: '2300', label: 'Pflegefreistellung', unit: 'd' },
  special_leave: { code: '2400', label: 'Sonderurlaub / Dienstverhinderung', unit: 'd' },
  training: { code: '2500', label: 'Fortbildung', unit: 'd' },
  unpaid: { code: '2600', label: 'Unbezahlt', unit: 'd' },
  holiday: { code: '2700', label: 'Feiertag (bezahlt)', unit: 'd' },
  remoteDays: { code: '3000', label: 'Telearbeitstage (Pauschale § 26 Z 9 EStG)', unit: 'd' },
  balanceEnd: { code: '9000', label: 'Zeitkonto Saldo Monatsende', unit: 'h' },
};

export function payrollCodes(org: OrgRow): typeof DEFAULT_PAYROLL_CODES {
  const custom = (org.settings as { payrollCodes?: Record<string, { code?: string; label?: string }> }).payrollCodes || {};
  const out: typeof DEFAULT_PAYROLL_CODES = { ...DEFAULT_PAYROLL_CODES };
  for (const [k, v] of Object.entries(custom)) if (out[k]) out[k] = { ...out[k], ...v };
  return out;
}

function style(ws: ExcelJS.Worksheet): void {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4EFEE' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.columns.forEach((c) => {
    let max = 10;
    c.eachCell?.({ includeEmpty: false }, (cell) => {
      const l = String(cell.value ?? '').length;
      if (l > max) max = Math.min(60, l);
    });
    c.width = max + 2;
  });
}

export async function buildPayrollXlsx(org: OrgRow, data: OrgMonth): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Zeitly';
  wb.created = new Date();
  const codes = payrollCodes(org);
  const label = fmtMonth(data.year, data.month);

  // Sheet 1: Übersicht je Mitarbeiter (Dezimalstunden)
  const ws = wb.addWorksheet('Lohnverrechnung');
  ws.columns = [
    { header: 'Personalnr', key: 'pn' },
    { header: 'Name', key: 'name' },
    { header: 'E-Mail', key: 'email' },
    { header: 'Monat', key: 'month' },
    { header: 'Vertrag Wo-Std', key: 'contract' },
    { header: 'Soll h', key: 'target' },
    { header: 'Ist h', key: 'worked' },
    { header: 'Reisezeit h', key: 'travel' },
    { header: 'Gutschriften h', key: 'credit' },
    { header: 'Normalstunden h', key: 'normal' },
    { header: 'Mehrarbeit h', key: 'mehr' },
    { header: 'Überstunden gesamt h', key: 'ot' },
    { header: 'ÜSt 50 % h', key: 'ot50' },
    { header: 'ÜSt 100 % h (Indikation)', key: 'ot100' },
    { header: 'Nachtstunden h', key: 'night' },
    { header: 'Sonntagsstunden h', key: 'sunday' },
    { header: 'Feiertagsarbeit h', key: 'holwork' },
    { header: 'Urlaub T', key: 'vac' },
    { header: 'Krankenstand T', key: 'sick' },
    { header: 'Zeitausgleich T', key: 'za' },
    { header: 'Pflegefreistellung T', key: 'care' },
    { header: 'Sonderurlaub T', key: 'special' },
    { header: 'Fortbildung T', key: 'training' },
    { header: 'Unbezahlt T', key: 'unpaid' },
    { header: 'Feiertage T', key: 'hol' },
    { header: 'Telearbeitstage', key: 'remote' },
    { header: 'Saldo Vormonat h', key: 'bstart' },
    { header: 'Saldo Monatsende h', key: 'bend' },
    { header: 'All-in', key: 'allin' },
    { header: 'Status', key: 'status' },
    { header: 'Eingereicht', key: 'submitted' },
    { header: 'Freigegeben', key: 'approved' },
    { header: 'Verstöße', key: 'errors' },
    { header: 'Hinweise', key: 'warns' },
  ];
  for (const e of data.employees) {
    const s = e.summary;
    const normal = Math.max(0, s.workedMinutes - s.overtimeMinutes - s.mehrarbeitMinutes);
    ws.addRow({
      pn: e.user.personnel_no || '',
      name: e.user.name,
      email: e.user.email,
      month: `${data.year}-${String(data.month).padStart(2, '0')}`,
      contract: hoursDecimal(e.weeklyMinutes),
      target: hoursDecimal(s.targetMinutes),
      worked: hoursDecimal(s.workedMinutes),
      travel: hoursDecimal(s.travelMinutes),
      credit: hoursDecimal(s.creditMinutes),
      normal: hoursDecimal(normal),
      mehr: hoursDecimal(s.mehrarbeitMinutes),
      ot: hoursDecimal(s.overtimeMinutes),
      ot50: hoursDecimal(s.overtime50Minutes),
      ot100: hoursDecimal(s.overtime100Minutes),
      night: hoursDecimal(s.nightMinutes),
      sunday: hoursDecimal(s.sundayMinutes),
      holwork: hoursDecimal(s.holidayMinutes),
      vac: s.absenceDays.vacation,
      sick: s.absenceDays.sick,
      za: s.absenceDays.time_comp,
      care: s.absenceDays.care_leave,
      special: s.absenceDays.special_leave,
      training: s.absenceDays.training,
      unpaid: s.absenceDays.unpaid,
      hol: s.holidayDays,
      remote: s.remoteOnlyDays,
      bstart: hoursDecimal(s.balanceStartMinutes),
      bend: hoursDecimal(s.balanceEndMinutes),
      allin: (e.user.employment as { allIn?: boolean })?.allIn ? 'ja' : '',
      status: PERIOD_LABELS[e.period?.status ?? 'open'],
      submitted: e.period?.submitted_at ? fmtDateTime(e.period.submitted_at, org.time_zone) : '',
      approved: e.period?.approved_at ? fmtDateTime(e.period.approved_at, org.time_zone) : '',
      errors: s.errorCount,
      warns: s.warnCount,
    });
  }
  style(ws);

  // Sheet 2: Lohnarten (Langformat für Import in LV-Systeme)
  const wl = wb.addWorksheet('Lohnarten-Import');
  wl.columns = [
    { header: 'Personalnr', key: 'pn' },
    { header: 'Name', key: 'name' },
    { header: 'Abrechnungsmonat', key: 'month' },
    { header: 'Lohnart', key: 'code' },
    { header: 'Bezeichnung', key: 'label' },
    { header: 'Menge', key: 'qty' },
    { header: 'Einheit', key: 'unit' },
  ];
  for (const e of data.employees) {
    const s = e.summary;
    const normal = Math.max(0, s.workedMinutes - s.overtimeMinutes - s.mehrarbeitMinutes);
    const vals: Array<[string, number]> = [
      ['normal', hoursDecimal(normal)],
      ['mehrarbeit', hoursDecimal(s.mehrarbeitMinutes)],
      ['ot50', hoursDecimal(s.overtime50Minutes)],
      ['ot100', hoursDecimal(s.overtime100Minutes)],
      ['travel', hoursDecimal(s.travelMinutes)],
      ['night', hoursDecimal(s.nightMinutes)],
      ['sunday', hoursDecimal(s.sundayMinutes)],
      ['holidayWork', hoursDecimal(s.holidayMinutes)],
      ['vacation', s.absenceDays.vacation],
      ['sick', s.absenceDays.sick],
      ['time_comp', s.absenceDays.time_comp],
      ['care_leave', s.absenceDays.care_leave],
      ['special_leave', s.absenceDays.special_leave],
      ['training', s.absenceDays.training],
      ['unpaid', s.absenceDays.unpaid],
      ['holiday', s.holidayDays],
      ['remoteDays', s.remoteOnlyDays],
      ['balanceEnd', hoursDecimal(s.balanceEndMinutes)],
    ];
    for (const [k, qty] of vals) {
      if (!qty && k !== 'balanceEnd') continue;
      const c = codes[k];
      wl.addRow({ pn: e.user.personnel_no || '', name: e.user.name, month: `${data.year}-${String(data.month).padStart(2, '0')}`, code: c.code, label: c.label, qty, unit: c.unit === 'h' ? 'Stunden' : 'Tage' });
    }
  }
  style(wl);

  // Sheet 3: Tage
  const wd = wb.addWorksheet('Tage');
  wd.columns = [
    { header: 'Personalnr', key: 'pn' },
    { header: 'Name', key: 'name' },
    { header: 'Datum', key: 'date' },
    { header: 'Wochentag', key: 'wd' },
    { header: 'Feiertag', key: 'hol' },
    { header: 'Abwesenheit', key: 'abs' },
    { header: 'Beginn', key: 'first' },
    { header: 'Ende', key: 'last' },
    { header: 'Pause min', key: 'break' },
    { header: 'Ist h', key: 'worked' },
    { header: 'Soll h', key: 'target' },
    { header: 'Gutschrift h', key: 'credit' },
    { header: 'Differenz h', key: 'diff' },
    { header: 'Nacht h', key: 'night' },
    { header: 'Orte', key: 'loc' },
    { header: 'Auffälligkeiten', key: 'viol' },
  ];
  const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  for (const e of data.employees) {
    for (const d of e.summary.days) {
      if (!d.isWorkDay && d.workedMinutes === 0 && !d.absenceType) continue;
      wd.addRow({
        pn: e.user.personnel_no || '',
        name: e.user.name,
        date: fmtDate(d.date),
        wd: WD[d.weekday - 1],
        hol: d.holidayName || '',
        abs: d.absenceType ? `${ABSENCE_LABELS[d.absenceType]}${d.absencePortion === 0.5 ? ' (½)' : ''}` : '',
        first: d.firstStart ? fmtT(d.firstStart, org.time_zone) : '',
        last: d.lastEnd ? fmtT(d.lastEnd, org.time_zone) : '',
        break: d.breakMinutes,
        worked: hoursDecimal(d.workedMinutes),
        target: hoursDecimal(d.targetMinutes),
        credit: hoursDecimal(d.creditMinutes),
        diff: hoursDecimal(d.workedMinutes + d.creditMinutes - d.targetMinutes),
        night: hoursDecimal(d.nightMinutes),
        loc: Object.keys(d.locations).map((l) => LOCATION_LABELS[l]).join(', '),
        viol: d.violations.filter((v) => v.severity !== 'info').map((v) => v.message).join(' | '),
      });
    }
  }
  style(wd);

  // Sheet 4: Buchungen (Rohdaten)
  const wb2 = wb.addWorksheet('Buchungen');
  wb2.columns = [
    { header: 'Personalnr', key: 'pn' },
    { header: 'Name', key: 'name' },
    { header: 'Datum', key: 'date' },
    { header: 'Beginn', key: 'start' },
    { header: 'Ende', key: 'end' },
    { header: 'Pause min', key: 'break' },
    { header: 'Dauer h', key: 'dur' },
    { header: 'Art', key: 'type' },
    { header: 'Ort', key: 'loc' },
    { header: 'Projekt', key: 'proj' },
    { header: 'Kostenstelle', key: 'cc' },
    { header: 'Notiz', key: 'note' },
    { header: 'Quelle', key: 'src' },
  ];
  for (const e of data.employees) {
    for (const d of e.summary.days) {
      for (const en of d.entries) {
        const net = en.startAt && en.endAt ? Math.max(0, Math.round((new Date(en.endAt).getTime() - new Date(en.startAt).getTime()) / 60000) - en.breakMinutes) : (en.durationMinutes ?? 0);
        const p = en.projectId ? data.projects.find((x) => x.id === en.projectId) : undefined;
        wb2.addRow({ pn: e.user.personnel_no || '', name: e.user.name, date: fmtDate(d.date), start: en.startAt ? fmtT(en.startAt, org.time_zone) : '', end: en.endAt ? fmtT(en.endAt, org.time_zone) : '', break: en.breakMinutes, dur: hoursDecimal(net), type: TYPE_LABELS[en.type], loc: LOCATION_LABELS[en.location], proj: p ? `${p.code} – ${p.name}` : '', cc: p?.cost_center || '', note: en.note || '', src: en.source });
      }
    }
  }
  style(wb2);

  // Sheet 5: Hinweise
  const wh = wb.addWorksheet('Hinweise');
  wh.addRow(['Zeitly – Export Lohnverrechnung', label]);
  wh.addRow(['Betrieb', org.legal_name || org.name]);
  wh.addRow(['Erstellt', fmtDateTime(new Date().toISOString(), org.time_zone)]);
  wh.addRow([]);
  wh.addRow(['Stunden sind Dezimalstunden (7,5 = 7:30). Tage: 0,5 = halber Tag.']);
  wh.addRow(['Überstunden: Tagesgrenze (8 h, Gleitzeit 10 h) + Wochengrenze ohne Doppelzählung. ÜSt 100 % ist eine Indikation (Nacht 22–06, Sonntag, Feiertag); maßgeblich ist der Kollektivvertrag.']);
  wh.addRow(['Mehrarbeit: Teilzeit – Stunden über Vertragsausmaß bis zur Vollzeitgrenze (§ 19d AZG), Zuschlag 25 % bzw. ZA laut Vereinbarung.']);
  wh.addRow(['Zeitkonto-Saldo: Vormonatssaldo + Ist + Gutschriften − Soll. Zeitausgleichstage reduzieren den Saldo um das Tagessoll.']);
  wh.addRow(['Lohnarten-Codes sind Vorschläge und in den Einstellungen anpassbar.']);
  wh.addRow(['Status „Freigegeben“ = vom Arbeitgeber geprüft; „Eingereicht“ = vom Mitarbeiter bestätigt; „Offen“ = Entwurf, Werte können sich noch ändern.']);
  wh.getColumn(1).width = 120;

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

export async function buildProjectsXlsx(org: OrgRow, data: OrgMonth): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Zeitly';
  const ws = wb.addWorksheet('Projekte');
  ws.columns = [
    { header: 'Projekt', key: 'proj' },
    { header: 'Kunde', key: 'cust' },
    { header: 'Kostenstelle', key: 'cc' },
    { header: 'Verrechenbar', key: 'bill' },
    { header: 'Stunden gesamt', key: 'h' },
    { header: 'Anteil %', key: 'pct' },
  ];
  const totals = new Map<string, number>();
  for (const e of data.employees) for (const [k, m] of Object.entries(e.summary.byProject)) totals.set(k, (totals.get(k) ?? 0) + m);
  const all = Array.from(totals.values()).reduce((a, b) => a + b, 0) || 1;
  for (const [k, m] of Array.from(totals.entries()).sort((a, b) => b[1] - a[1])) {
    const p = data.projects.find((x) => x.id === k);
    ws.addRow({ proj: projectLabel(data.projects, k), cust: p?.customer || '', cc: p?.cost_center || '', bill: p?.billable ? 'ja' : '', h: hoursDecimal(m), pct: Math.round((m / all) * 1000) / 10 });
  }
  style(ws);
  const wm = wb.addWorksheet('Projekt x Mitarbeiter');
  wm.columns = [
    { header: 'Projekt', key: 'proj' },
    { header: 'Kostenstelle', key: 'cc' },
    { header: 'Personalnr', key: 'pn' },
    { header: 'Mitarbeiter', key: 'name' },
    { header: 'Stunden', key: 'h' },
    { header: 'h:mm', key: 'hm' },
  ];
  for (const e of data.employees) {
    for (const [k, m] of Object.entries(e.summary.byProject).sort((a, b) => b[1] - a[1])) {
      const p = data.projects.find((x) => x.id === k);
      wm.addRow({ proj: projectLabel(data.projects, k), cc: p?.cost_center || '', pn: e.user.personnel_no || '', name: e.user.name, h: hoursDecimal(m), hm: formatMinutes(m) });
    }
  }
  style(wm);
  const wl = wb.addWorksheet('Arbeitsorte');
  wl.columns = [
    { header: 'Mitarbeiter', key: 'name' },
    { header: 'Büro h', key: 'office' },
    { header: 'Telearbeit h', key: 'remote' },
    { header: 'Außendienst h', key: 'field' },
    { header: 'Reine Telearbeitstage', key: 'rd' },
  ];
  for (const e of data.employees) wl.addRow({ name: e.user.name, office: hoursDecimal(e.summary.byLocation.office ?? 0), remote: hoursDecimal(e.summary.byLocation.remote ?? 0), field: hoursDecimal(e.summary.byLocation.field ?? 0), rd: e.summary.remoteOnlyDays });
  style(wl);
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

/** Semicolon CSV (Excel/AT friendly, UTF-8 BOM) in long wage-type format. */
export function buildPayrollCsv(org: OrgRow, data: OrgMonth): string {
  const codes = payrollCodes(org);
  const lines = ['Personalnr;Name;Monat;Lohnart;Bezeichnung;Menge;Einheit'];
  const dec = (n: number) => String(n).replace('.', ',');
  for (const e of data.employees) {
    const s = e.summary;
    const normal = Math.max(0, s.workedMinutes - s.overtimeMinutes - s.mehrarbeitMinutes);
    const vals: Array<[string, number]> = [
      ['normal', hoursDecimal(normal)],
      ['mehrarbeit', hoursDecimal(s.mehrarbeitMinutes)],
      ['ot50', hoursDecimal(s.overtime50Minutes)],
      ['ot100', hoursDecimal(s.overtime100Minutes)],
      ['travel', hoursDecimal(s.travelMinutes)],
      ['vacation', s.absenceDays.vacation],
      ['sick', s.absenceDays.sick],
      ['time_comp', s.absenceDays.time_comp],
      ['care_leave', s.absenceDays.care_leave],
      ['special_leave', s.absenceDays.special_leave],
      ['training', s.absenceDays.training],
      ['unpaid', s.absenceDays.unpaid],
      ['holiday', s.holidayDays],
      ['remoteDays', s.remoteOnlyDays],
      ['balanceEnd', hoursDecimal(s.balanceEndMinutes)],
    ];
    for (const [k, q] of vals) {
      if (!q && k !== 'balanceEnd') continue;
      const c = codes[k];
      lines.push([e.user.personnel_no || '', e.user.name, `${data.year}-${String(data.month).padStart(2, '0')}`, c.code, c.label, dec(q), c.unit === 'h' ? 'Stunden' : 'Tage'].map(csv).join(';'));
    }
  }
  return '﻿' + lines.join('\r\n');
}

function csv(v: string): string {
  return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function fmtT(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(iso));
}
