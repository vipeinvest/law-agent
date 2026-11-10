import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { PeriodSummary } from '@/domain/types';
import { formatMinutes } from '@/domain/time';
import { ABSENCE_LABELS, fmtDate, fmtDateTime, fmtMonth, LOCATION_LABELS, TYPE_LABELS, WEEKDAYS_SHORT } from '../format';
import type { OrgRow, UserRow } from '../org';
import type { PeriodRow, ProjectRow } from '../repo';
import { hexToRgb } from '../org';

const A4: [number, number] = [595.28, 841.89];
const M = 40;

/** Replace characters outside WinAnsi so Helvetica can encode them. */
function safe(s: string): string {
  return s
    .replace(/Λ/g, 'A')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“„”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x00-\xff]/g, '?');
}

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
  pageNo: number;
  brand: [number, number, number];
  header: () => void;
  footerText: string;
}

function newPage(ctx: Ctx): void {
  if (ctx.pageNo > 0) drawFooter(ctx);
  ctx.page = ctx.doc.addPage(A4);
  ctx.pageNo++;
  ctx.y = A4[1] - M;
  ctx.header();
}

function drawFooter(ctx: Ctx): void {
  const text = safe(`${ctx.footerText} · Seite ${ctx.pageNo}`);
  ctx.page.drawText(text, { x: M, y: 22, size: 7.5, font: ctx.font, color: rgb(0.45, 0.45, 0.45) });
}

function ensure(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < 50) newPage(ctx);
}

function text(ctx: Ctx, s: string, x: number, size = 9, opts: { bold?: boolean; color?: [number, number, number]; maxWidth?: number; align?: 'left' | 'right' } = {}): void {
  const font = opts.bold ? ctx.bold : ctx.font;
  let str = safe(s);
  if (opts.maxWidth) {
    while (str.length > 1 && font.widthOfTextAtSize(str, size) > opts.maxWidth) str = str.slice(0, -2) + '…'.replace('…', '.');
  }
  const w = font.widthOfTextAtSize(str, size);
  const xx = opts.align === 'right' ? x - w : x;
  const c = opts.color ?? [0.07, 0.09, 0.15];
  ctx.page.drawText(str, { x: xx, y: ctx.y, size, font, color: rgb(c[0] / 255 > 1 ? 1 : c[0] > 1 ? c[0] / 255 : c[0], c[1] > 1 ? c[1] / 255 : c[1], c[2] > 1 ? c[2] / 255 : c[2]) });
}

export interface JournalInput {
  org: OrgRow;
  user: UserRow;
  summary: PeriodSummary;
  period: PeriodRow | null;
  projects: ProjectRow[];
  weeklyMinutes: number;
  recordMode: 'full' | 'duration_only';
  approverName?: string | null;
}

export async function buildJournalPdf(inputs: JournalInput[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(`Arbeitszeitnachweis ${inputs.length === 1 ? inputs[0].user.name : inputs[0]?.org.name ?? ''}`);
  doc.setAuthor('Fairhours');
  doc.setCreator('Fairhours – Arbeitszeiterfassung');
  for (const input of inputs) renderEmployee(doc, font, bold, input);
  return doc.save();
}

function renderEmployee(doc: PDFDocument, font: PDFFont, bold: PDFFont, input: JournalInput): void {
  const { org, user, summary, period, projects } = input;
  const tz = org.time_zone;
  const brandRgb = hexToRgb((org.theme as { primary?: string })?.primary || '#1f5f5b') ?? [31, 95, 91];
  const brand: [number, number, number] = [brandRgb[0] / 255, brandRgb[1] / 255, brandRgb[2] / 255];
  const title = `Arbeitszeitnachweis ${fmtMonth(summary.year, summary.month)}`;
  const ctx: Ctx = {
    doc,
    page: undefined as unknown as PDFPage,
    font,
    bold,
    y: 0,
    pageNo: 0,
    brand,
    footerText: `${org.name} · ${user.name} · ${title} · Aufzeichnung gemäß § 26 AZG · erstellt ${fmtDateTime(new Date().toISOString(), tz)} mit Fairhours`,
    header: () => {
      ctx.page.drawRectangle({ x: 0, y: A4[1] - 26, width: A4[0], height: 26, color: rgb(brand[0], brand[1], brand[2]) });
      ctx.page.drawText(safe((org.theme as { appName?: string })?.appName || org.name), { x: M, y: A4[1] - 17, size: 10, font: bold, color: rgb(1, 1, 1) });
      ctx.page.drawText(safe(`${user.name} · ${title}`), { x: A4[0] - M - bold.widthOfTextAtSize(safe(`${user.name} · ${title}`), 9), y: A4[1] - 17, size: 9, font: bold, color: rgb(1, 1, 1) });
      ctx.y = A4[1] - 50;
    },
  };
  newPage(ctx);

  // title block
  text(ctx, title, M, 16, { bold: true });
  ctx.y -= 18;
  text(ctx, `${org.legal_name || org.name}${org.address ? ' · ' + org.address : ''}${org.uid_number ? ' · UID ' + org.uid_number : ''}`, M, 8.5, { color: [0.35, 0.35, 0.35] });
  ctx.y -= 14;
  const infoLeft = [
    ['Mitarbeiter:in', user.name],
    ['Personalnummer', user.personnel_no || '–'],
    ['E-Mail', user.email],
    ['Wochenarbeitszeit (Vertrag)', `${formatMinutes(input.weeklyMinutes)} h`],
    ['Erfassungsart', input.recordMode === 'full' ? 'Beginn, Ende, Pausen (§ 26 Abs 1 AZG)' : 'Nur Dauer (§ 26 Abs 3 AZG)'],
  ];
  const infoRight = [
    ['Zeitraum', `${fmtDate(summary.from)} – ${fmtDate(summary.to)}`],
    ['Status', period ? ({ open: 'Offen', submitted: 'Eingereicht', approved: 'Freigegeben', exported: 'Exportiert', reopened: 'Wieder geöffnet' } as Record<string, string>)[period.status] : 'Offen (Entwurf)'],
    ['Eingereicht', period?.submitted_at ? `${fmtDateTime(period.submitted_at, tz)}${period.submitted_ip ? ' · IP ' + period.submitted_ip : ''}` : '–'],
    ['Freigegeben', period?.approved_at ? `${fmtDateTime(period.approved_at, tz)}${input.approverName ? ' · ' + input.approverName : ''}` : '–'],
    ['Saldo Vormonat', `${formatMinutes(summary.balanceStartMinutes, { sign: true })} h`],
  ];
  const startY = ctx.y;
  for (const [k, v] of infoLeft) {
    text(ctx, k, M, 8, { color: [0.4, 0.4, 0.4] });
    text(ctx, v, M + 120, 8.5, { maxWidth: 140 });
    ctx.y -= 12;
  }
  ctx.y = startY;
  for (const [k, v] of infoRight) {
    text(ctx, k, M + 290, 8, { color: [0.4, 0.4, 0.4] });
    text(ctx, v, M + 370, 8.5, { maxWidth: 150 });
    ctx.y -= 12;
  }
  ctx.y -= 10;

  // day table
  const cols = [
    { k: 'Datum', x: M, w: 56 },
    { k: 'Beginn', x: M + 58, w: 34 },
    { k: 'Ende', x: M + 94, w: 34 },
    { k: 'Pause', x: M + 130, w: 32, r: true },
    { k: 'Netto', x: M + 170, w: 34, r: true },
    { k: 'Soll', x: M + 208, w: 32, r: true },
    { k: 'Diff', x: M + 246, w: 36, r: true },
    { k: 'Art / Ort', x: M + 290, w: 90 },
    { k: 'Projekt / Bemerkung', x: M + 384, w: 132 },
  ];
  const drawHead = () => {
    ensure(ctx, 30);
    ctx.page.drawRectangle({ x: M - 4, y: ctx.y - 4, width: A4[0] - 2 * M + 8, height: 14, color: rgb(0.93, 0.94, 0.96) });
    for (const c of cols) text(ctx, c.k, c.r ? c.x + c.w : c.x, 7.5, { bold: true, align: c.r ? 'right' : 'left' });
    ctx.y -= 16;
  };
  drawHead();
  for (const d of summary.days) {
    const rows: Array<{ start: string; end: string; pause: string; net: string; kind: string; note: string }> = [];
    const timed = d.entries.filter((e) => e.startAt && e.endAt);
    for (const e of d.entries) {
      const net = e.startAt && e.endAt ? Math.max(0, Math.round((new Date(e.endAt).getTime() - new Date(e.startAt).getTime()) / 60000) - e.breakMinutes) : (e.durationMinutes ?? 0);
      const proj = e.projectId ? projects.find((p) => p.id === e.projectId)?.code : '';
      rows.push({
        start: e.startAt ? fmtTime(e.startAt, tz) : '',
        end: e.endAt ? fmtTime(e.endAt, tz) : e.startAt ? 'offen' : '',
        pause: e.breakMinutes ? String(e.breakMinutes) : '',
        net: formatMinutes(net),
        kind: `${e.type !== 'work' ? TYPE_LABELS[e.type] + ' · ' : ''}${LOCATION_LABELS[e.location]}`,
        note: [proj, e.note].filter(Boolean).join(' · '),
      });
    }
    if (d.autoBreakMinutes > 0) rows.push({ start: '', end: '', pause: String(d.autoBreakMinutes), net: '', kind: 'Pause lt. Vereinbarung', note: 'automatisch abgezogen' });
    const labelParts: string[] = [];
    if (d.holidayName) labelParts.push(d.holidayName);
    if (d.absenceType) labelParts.push(`${ABSENCE_LABELS[d.absenceType]}${d.absencePortion === 0.5 ? ' (1/2)' : ''}`);
    if (rows.length === 0) rows.push({ start: '', end: '', pause: '', net: d.workedMinutes ? formatMinutes(d.workedMinutes) : '', kind: labelParts.join(', '), note: '' });
    else if (labelParts.length) rows[0].kind = `${labelParts.join(', ')} · ${rows[0].kind}`;
    const lineH = 11;
    ensure(ctx, rows.length * lineH + 4);
    if (ctx.y === A4[1] - 50) drawHead();
    const weekend = d.weekday >= 6;
    if (weekend || d.isHoliday) ctx.page.drawRectangle({ x: M - 4, y: ctx.y - rows.length * lineH + 8, width: A4[0] - 2 * M + 8, height: rows.length * lineH, color: rgb(0.97, 0.97, 0.98) });
    const diff = d.isWorkDay || d.workedMinutes > 0 ? d.workedMinutes + d.creditMinutes - d.targetMinutes : 0;
    rows.forEach((r, i) => {
      if (i === 0) {
        text(ctx, `${WEEKDAYS_SHORT[d.weekday - 1]} ${fmtDate(d.date, { year: false })}`, cols[0].x, 8, { bold: weekend || d.isHoliday ? false : true });
        text(ctx, formatMinutes(d.targetMinutes), cols[5].x + cols[5].w, 8, { align: 'right' });
        if (d.isWorkDay || d.workedMinutes > 0) text(ctx, formatMinutes(diff, { sign: true }), cols[6].x + cols[6].w, 8, { align: 'right', color: diff < 0 ? [0.7, 0.1, 0.1] : diff > 0 ? [0.05, 0.45, 0.25] : [0.3, 0.3, 0.3] });
      }
      text(ctx, r.start, cols[1].x, 8);
      text(ctx, r.end, cols[2].x, 8);
      text(ctx, r.pause, cols[3].x + cols[3].w, 8, { align: 'right' });
      text(ctx, r.net, cols[4].x + cols[4].w, 8, { align: 'right' });
      text(ctx, r.kind, cols[7].x, 7.5, { maxWidth: cols[7].w });
      text(ctx, r.note, cols[8].x, 7.5, { maxWidth: cols[8].w, color: [0.3, 0.3, 0.3] });
      ctx.y -= lineH;
    });
    if (d.entries.length > 1) {
      ensure(ctx, lineH);
      text(ctx, 'Tag gesamt', cols[1].x, 7.5, { color: [0.3, 0.3, 0.3] });
      text(ctx, d.breakMinutes ? String(d.breakMinutes) : '', cols[3].x + cols[3].w, 7.5, { align: 'right', color: [0.3, 0.3, 0.3] });
      text(ctx, formatMinutes(d.workedMinutes), cols[4].x + cols[4].w, 8, { align: 'right', bold: true });
      ctx.y -= lineH;
    }
    const flagged = d.violations.filter((v) => v.severity !== 'info');
    for (const v of flagged) {
      ensure(ctx, lineH);
      text(ctx, `${v.severity === 'error' ? '!' : 'i'} ${v.message} (${v.legalRef})`, cols[1].x, 7, { color: v.severity === 'error' ? [0.7, 0.1, 0.1] : [0.6, 0.4, 0.05], maxWidth: 440 });
      ctx.y -= 10;
    }
  }

  // totals
  ctx.y -= 6;
  ensure(ctx, 120);
  ctx.page.drawLine({ start: { x: M, y: ctx.y + 8 }, end: { x: A4[0] - M, y: ctx.y + 8 }, thickness: 0.8, color: rgb(brand[0], brand[1], brand[2]) });
  text(ctx, 'Monatssummen', M, 10, { bold: true });
  ctx.y -= 14;
  const totals: Array<[string, string]> = [
    ['Sollstunden', formatMinutes(summary.targetMinutes)],
    ['Iststunden (inkl. Reisezeit)', formatMinutes(summary.workedMinutes)],
    ['davon Reisezeit', formatMinutes(summary.travelMinutes)],
    ['Gutschriften (Feiertag/Urlaub/Krankenstand …)', formatMinutes(summary.creditMinutes)],
    ['Zeitausgleich verbraucht', formatMinutes(summary.timeCompMinutes)],
    ['Überstunden gesamt', formatMinutes(summary.overtimeMinutes)],
    ['  davon mit 100 %-Indikation (Nacht/So/Feiertag)', formatMinutes(summary.overtime100Minutes)],
    ['Mehrarbeit (Teilzeit, § 19d AZG)', formatMinutes(summary.mehrarbeitMinutes)],
    ['Nacht- / Sonntags- / Feiertagsstunden', `${formatMinutes(summary.nightMinutes)} / ${formatMinutes(summary.sundayMinutes)} / ${formatMinutes(summary.holidayMinutes)}`],
    ['Saldo Vormonat → Monatsende', `${formatMinutes(summary.balanceStartMinutes, { sign: true })} → ${formatMinutes(summary.balanceEndMinutes, { sign: true })}`],
  ];
  const right: Array<[string, string]> = [
    ['Arbeitstage gebucht', String(summary.workedDays)],
    ['Feiertage (Arbeitstage)', String(summary.holidayDays)],
    ['Urlaub (Tage)', String(summary.absenceDays.vacation)],
    ['Krankenstand (Tage)', String(summary.absenceDays.sick)],
    ['Zeitausgleich (Tage)', String(summary.absenceDays.time_comp)],
    ['Pflegefreistellung / Sonderurlaub', `${summary.absenceDays.care_leave} / ${summary.absenceDays.special_leave}`],
    ['Fortbildung / Unbezahlt', `${summary.absenceDays.training} / ${summary.absenceDays.unpaid}`],
    ['Reine Telearbeitstage', String(summary.remoteOnlyDays)],
    ['Auffälligkeiten (Verstöße / Hinweise)', `${summary.errorCount} / ${summary.warnCount}`],
  ];
  const y0 = ctx.y;
  for (const [k, v] of totals) {
    text(ctx, k, M, 8, { color: [0.3, 0.3, 0.3] });
    text(ctx, v, M + 265, 8.5, { align: 'right', bold: true });
    ctx.y -= 11;
  }
  const yEndLeft = ctx.y;
  ctx.y = y0;
  for (const [k, v] of right) {
    text(ctx, k, M + 300, 8, { color: [0.3, 0.3, 0.3] });
    text(ctx, v, A4[0] - M, 8.5, { align: 'right', bold: true });
    ctx.y -= 11;
  }
  ctx.y = Math.min(yEndLeft, ctx.y) - 8;

  // projects
  const projEntries = Object.entries(summary.byProject).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]);
  if (projEntries.length) {
    ensure(ctx, 20 + projEntries.length * 11);
    text(ctx, 'Projekte / Kostenstellen', M, 9, { bold: true });
    ctx.y -= 12;
    for (const [id, m] of projEntries) {
      const p = projects.find((x) => x.id === id);
      text(ctx, p ? `${p.code} – ${p.name}${p.cost_center ? ' (' + p.cost_center + ')' : ''}` : 'Ohne Projekt', M, 8, { maxWidth: 300 });
      text(ctx, formatMinutes(m), M + 360, 8, { align: 'right' });
      ctx.y -= 11;
    }
    ctx.y -= 6;
  }

  if (period?.employee_note) {
    ensure(ctx, 30);
    text(ctx, 'Anmerkung Mitarbeiter:in:', M, 8, { bold: true });
    ctx.y -= 11;
    text(ctx, period.employee_note, M, 8, { maxWidth: 500 });
    ctx.y -= 14;
  }

  // signatures
  ensure(ctx, 70);
  ctx.y -= 20;
  for (const [i, label] of ['Arbeitnehmer:in', 'Arbeitgeber:in / Vorgesetzte:r'].entries()) {
    const x = M + i * 260;
    ctx.page.drawLine({ start: { x, y: ctx.y }, end: { x: x + 220, y: ctx.y }, thickness: 0.6, color: rgb(0.5, 0.5, 0.5) });
    ctx.page.drawText(safe(label), { x, y: ctx.y - 10, size: 7.5, font, color: rgb(0.4, 0.4, 0.4) });
  }
  ctx.y -= 24;
  if (period?.submitted_at) text(ctx, `Elektronisch bestätigt durch ${user.name} am ${fmtDateTime(period.submitted_at, tz)}${period.approved_at ? `; freigegeben am ${fmtDateTime(period.approved_at, tz)}` : ''}. Änderungen sind im Protokoll nachvollziehbar.`, M, 7, { color: [0.35, 0.35, 0.35], maxWidth: 520 });
  drawFooter(ctx);
}

function fmtTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(iso));
}
