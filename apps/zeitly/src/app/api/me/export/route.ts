import ExcelJS from 'exceljs';
import { getDb } from '@/db/client';
import { apiSession, clientIp } from '@/lib/auth';
import { handler, unauthorized } from '@/lib/api';
import { audit } from '@/lib/audit';
import { fileSafe } from '@/lib/export/common';
import { fmtDate, LOCATION_LABELS, TYPE_LABELS, ABSENCE_LABELS } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** Art. 15 DSGVO / § 26 Abs 8 AZG – the employee's own data. */
export const GET = handler(async (req) => {
  const s = await apiSession();
  if (!s) return unauthorized();
  const format = new URL(req.url).searchParams.get('format') === 'json' ? 'json' : 'xlsx';
  const db = await getDb();
  const [entries, absences, periods, logins, auditRows] = await Promise.all([
    db.query(`select date, start_at, end_at, break_minutes, duration_minutes, type, location, project_id, note, source, status, created_at, updated_at from zt_time_entries where user_id = $1 and deleted_at is null order by date, start_at`, [s.user.id]),
    db.query(`select date_from, date_to, type, half_day, note, status, created_at, decided_at from zt_absences where user_id = $1 and deleted_at is null order by date_from`, [s.user.id]),
    db.query(`select year, month, status, submitted_at, approved_at, balance_start, balance_end, employee_note from zt_periods where user_id = $1 order by year, month`, [s.user.id]),
    db.query(`select created_at, last_seen_at, ip, user_agent from zt_sessions where user_id = $1 order by created_at desc limit 100`, [s.user.id]),
    db.query(`select action, entity, entity_id, at, actor_email from zt_audit_log where org_id = $1 and (actor_id = $2 or (entity in ('time_entry','absence','period','user') and (after->>'user_id' = $2::text or before->>'user_id' = $2::text or entity_id = $2::text))) order by at desc limit 2000`, [s.org.id, s.user.id]),
  ]);
  await audit(db, { id: s.user.id, email: s.user.email, ip: clientIp() }, s.org.id, 'me.export', 'user', s.user.id, null, { format });
  const profile = { id: s.user.id, name: s.user.name, email: s.user.email, role: s.user.role, personnel_no: s.user.personnel_no, employment: s.user.employment, created_at: s.user.created_at, last_login_at: s.user.last_login_at, consent_at: s.user.consent_at, organisation: { name: s.org.name, legal_name: s.org.legal_name, address: s.org.address } };
  if (format === 'json') {
    const body = JSON.stringify({ exported_at: new Date().toISOString(), profile, time_entries: entries.rows, absences: absences.rows, periods: periods.rows, sessions: logins.rows, audit: auditRows.rows }, null, 2);
    return new Response(body, { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="Datenauskunft_${fileSafe(s.user.name)}.json"` } });
  }
  const wb = new ExcelJS.Workbook();
  const w1 = wb.addWorksheet('Buchungen');
  w1.columns = ['Datum', 'Beginn', 'Ende', 'Pause min', 'Dauer min', 'Art', 'Ort', 'Notiz', 'Quelle', 'Status'].map((h) => ({ header: h, width: 14 }));
  const tz = s.org.time_zone;
  const t = (v: unknown) => (v ? new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(String(v))) : '');
  for (const r of entries.rows as Record<string, unknown>[]) w1.addRow([fmtDate(String(r.date)), t(r.start_at), t(r.end_at), r.break_minutes, r.duration_minutes ?? '', TYPE_LABELS[String(r.type)], LOCATION_LABELS[String(r.location)], r.note ?? '', r.source, r.status]);
  const w2 = wb.addWorksheet('Abwesenheiten');
  w2.columns = ['Von', 'Bis', 'Art', 'Halber Tag', 'Status', 'Notiz'].map((h) => ({ header: h, width: 16 }));
  for (const r of absences.rows as Record<string, unknown>[]) w2.addRow([fmtDate(String(r.date_from)), fmtDate(String(r.date_to)), ABSENCE_LABELS[String(r.type)], r.half_day ? 'ja' : '', r.status, r.note ?? '']);
  const w3 = wb.addWorksheet('Monate');
  w3.columns = ['Jahr', 'Monat', 'Status', 'Eingereicht', 'Freigegeben', 'Saldo Start min', 'Saldo Ende min'].map((h) => ({ header: h, width: 16 }));
  for (const r of periods.rows as Record<string, unknown>[]) w3.addRow([r.year, r.month, r.status, r.submitted_at ?? '', r.approved_at ?? '', r.balance_start, r.balance_end]);
  const w4 = wb.addWorksheet('Profil');
  for (const [k, v] of Object.entries(profile)) w4.addRow([k, typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')]);
  const buf = await wb.xlsx.writeBuffer();
  return new Response(Buffer.from(buf as ArrayBuffer), { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="Meine_Zeiten_${fileSafe(s.user.name)}.xlsx"` } });
});
