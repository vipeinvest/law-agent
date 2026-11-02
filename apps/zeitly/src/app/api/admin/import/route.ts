import { z } from 'zod';
import ExcelJS from 'exceljs';
import { getDb } from '@/db/client';
import { apiSession, clientIp } from '@/lib/auth';
import { ApiError, fail, handler, json, unauthorized } from '@/lib/api';
import { audit } from '@/lib/audit';
import { listUsers } from '@/lib/repo';
import { createEntry } from '@/lib/entries';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ParsedSheet {
  sheet: string;
  headers: string[];
  rows: string[][];
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (v instanceof Date) {
    // ExcelJS gives dates as UTC Date; times-only cells have 1899-12-30 base
    const y = v.getUTCFullYear();
    if (y < 1905) return `${String(v.getUTCHours()).padStart(2, '0')}:${String(v.getUTCMinutes()).padStart(2, '0')}`;
    return `${y}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue);
    if ('text' in v) return String((v as { text: string }).text);
    return String(v);
  }
  return String(v);
}

async function parseWorkbook(buf: ArrayBuffer, filename: string): Promise<ParsedSheet[]> {
  const wb = new ExcelJS.Workbook();
  if (/\.csv$/i.test(filename)) {
    const text = Buffer.from(buf).toString('utf8').replace(/^﻿/, '');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const sep = (lines[0] || '').includes(';') ? ';' : ',';
    const rows = lines.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')));
    return [{ sheet: 'CSV', headers: rows[0] || [], rows: rows.slice(1) }];
  }
  await wb.xlsx.load(buf);
  const out: ParsedSheet[] = [];
  wb.eachSheet((ws) => {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals: string[] = [];
      for (let c = 1; c <= Math.max(row.cellCount, 12); c++) vals.push(cellText(row.getCell(c).value));
      rows.push(vals);
    });
    if (rows.length === 0) return;
    // header = first row with >= 2 non-empty cells
    const hi = rows.findIndex((r) => r.filter((x) => x).length >= 2);
    if (hi < 0) return;
    out.push({ sheet: ws.name, headers: rows[hi].map((h, i) => h || `Spalte ${i + 1}`), rows: rows.slice(hi + 1).filter((r) => r.some((x) => x)) });
  });
  return out;
}

const mappingSchema = z.object({
  sheet: z.string(),
  date: z.number().int(),
  start: z.number().int().nullable(),
  end: z.number().int().nullable(),
  breakMinutes: z.number().int().nullable(),
  duration: z.number().int().nullable(),
  employee: z.number().int().nullable(),
  note: z.number().int().nullable(),
  project: z.number().int().nullable(),
  defaultUserId: z.string().uuid().nullable(),
  defaultLocation: z.enum(['office', 'remote', 'field']).default('office'),
  dryRun: z.boolean().default(true),
});

function parseDate(s: string): string | null {
  s = s.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}
function parseTime(s: string): string | null {
  s = s.trim();
  const m = /^(\d{1,2})[:.](\d{2})/.exec(s);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  const n = Number(s.replace(',', '.'));
  if (!Number.isNaN(n) && n > 0 && n < 1) {
    const mins = Math.round(n * 1440);
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }
  return null;
}
function parseMinutes(s: string): number | null {
  s = s.trim();
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(s.replace(',', '.'));
  if (Number.isNaN(n)) return null;
  return n <= 24 ? Math.round(n * 60) : Math.round(n); // hours vs minutes heuristic
}

export const POST = handler(async (req) => {
  const s = await apiSession('admin');
  if (!s) return unauthorized();
  const ct = req.headers.get('content-type') || '';
  const db = await getDb();
  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return fail(400, 'Datei fehlt.');
    if (file.size > 8 * 1024 * 1024) return fail(400, 'Datei größer als 8 MB.');
    const sheets = await parseWorkbook(await file.arrayBuffer(), file.name);
    if (!sheets.length) return fail(400, 'Keine Daten in der Datei gefunden.');
    const users = await listUsers(db, s.org.id);
    return json({ filename: file.name, sheets: sheets.map((sh) => ({ ...sh, rows: sh.rows.slice(0, 2000), total: sh.rows.length })), users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, personnelNo: u.personnel_no })) });
  }
  const body = await req.json();
  const mapping = mappingSchema.parse(body.mapping);
  const rows: string[][] = z.array(z.array(z.string())).parse(body.rows);
  const users = await listUsers(db, s.org.id);
  const projects = await db.query<{ id: string; code: string; name: string }>(`select id, code, name from zt_projects where org_id = $1`, [s.org.id]);
  const findUser = (txt: string) => {
    const t = txt.trim().toLowerCase();
    if (!t) return null;
    return users.find((u) => u.email.toLowerCase() === t || u.name.toLowerCase() === t || (u.personnel_no && u.personnel_no.toLowerCase() === t) || u.name.toLowerCase().split(' ').reverse().join(' ') === t) ?? null;
  };
  const findProject = (txt: string) => {
    const t = txt.trim().toLowerCase();
    if (!t) return null;
    return projects.rows.find((p) => p.code.toLowerCase() === t || p.name.toLowerCase() === t) ?? null;
  };
  const errors: Array<{ row: number; error: string }> = [];
  const prepared: Array<{ row: number; userId: string; userName: string; date: string; start: string | null; end: string | null; breakMinutes: number; durationMinutes: number | null; note: string | null; projectId: string | null }> = [];
  rows.forEach((r, i) => {
    const rowNo = i + 2;
    const date = parseDate(r[mapping.date] ?? '');
    if (!date) return errors.push({ row: rowNo, error: `Datum nicht erkannt: „${r[mapping.date] ?? ''}“` });
    const user = mapping.employee != null ? findUser(r[mapping.employee] ?? '') : users.find((u) => u.id === mapping.defaultUserId);
    if (!user) return errors.push({ row: rowNo, error: `Mitarbeiter:in nicht gefunden: „${mapping.employee != null ? r[mapping.employee] : ''}“` });
    const start = mapping.start != null ? parseTime(r[mapping.start] ?? '') : null;
    const end = mapping.end != null ? parseTime(r[mapping.end] ?? '') : null;
    const breakMinutes = mapping.breakMinutes != null ? (parseMinutes(r[mapping.breakMinutes] ?? '') ?? 0) : 0;
    const durationMinutes = mapping.duration != null ? parseMinutes(r[mapping.duration] ?? '') : null;
    if (!start && durationMinutes == null) return errors.push({ row: rowNo, error: 'Weder Beginn/Ende noch Dauer vorhanden' });
    if (start && !end) return errors.push({ row: rowNo, error: 'Ende fehlt' });
    const note = mapping.note != null ? (r[mapping.note] ?? '').trim() || null : null;
    const projectId = mapping.project != null ? (findProject(r[mapping.project] ?? '')?.id ?? null) : null;
    prepared.push({ row: rowNo, userId: user.id, userName: user.name, date, start, end, breakMinutes, durationMinutes: start ? null : durationMinutes, note, projectId });
  });
  if (mapping.dryRun) return json({ dryRun: true, ok: prepared.length, errors, sample: prepared.slice(0, 20) });
  let imported = 0;
  const importErrors = [...errors];
  const actor = { id: s.user.id, email: s.user.email, ip: clientIp() };
  for (const p of prepared) {
    try {
      await createEntry(db, s, actor, { date: p.date, start: p.start, end: p.end, breakMinutes: p.breakMinutes, durationMinutes: p.durationMinutes, type: 'work', location: mapping.defaultLocation, projectId: p.projectId, note: p.note, userId: p.userId }, s.org.time_zone, 'import');
      imported++;
    } catch (e) {
      importErrors.push({ row: p.row, error: e instanceof ApiError ? e.message : 'Fehler beim Speichern' });
    }
  }
  await db.query(`insert into zt_import_jobs (org_id, created_by, filename, mapping, rows_total, rows_imported, rows_skipped, errors) values ($1,$2,$3,$4,$5,$6,$7,$8)`, [s.org.id, s.user.id, body.filename ?? null, JSON.stringify(mapping), rows.length, imported, rows.length - imported, JSON.stringify(importErrors.slice(0, 200))]);
  await audit(db, actor, s.org.id, 'import.run', 'import', null, null, { filename: body.filename, rows: rows.length, imported, errors: importErrors.length });
  return json({ dryRun: false, imported, errors: importErrors });
});
