import { getDb } from '@/db/client';
import { requireSession } from '@/lib/auth';
import { evaluateOrgMonth } from '@/lib/export/common';
import { toISODate } from '@/domain/time';
import { prevMonth } from '@/lib/period';
import { fmtH, fmtMonth, PERIOD_LABELS } from '@/lib/format';
import { Badge, Card, PageHeader } from '@/components/ui';
import { ExportPanel } from './ExportPanel';

export const dynamic = 'force-dynamic';

export default async function ExportPage({ searchParams }: { searchParams: { m?: string } }) {
  const s = await requireSession();
  const db = await getDb();
  const today = toISODate(new Date(), s.org.time_zone);
  const [dy, dm] = prevMonth(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
  const m = /^\d{4}-\d{2}$/.test(searchParams.m ?? '') ? searchParams.m! : `${dy}-${String(dm).padStart(2, '0')}`;
  const year = Number(m.slice(0, 4));
  const month = Number(m.slice(5, 7));
  const data = await evaluateOrgMonth(db, s, year, month);
  const approved = data.employees.filter((e) => e.period && (e.period.status === 'approved' || e.period.status === 'exported')).length;
  return (
    <div>
      <PageHeader title="Export Lohnverrechnung & Buchhaltung" subtitle={`${fmtMonth(year, month)} · ${approved} von ${data.employees.length} Monaten freigegeben`} />
      <ExportPanel year={year} month={month} payrollEmail={s.org.payroll_email} employees={data.employees.map((e) => ({ id: e.user.id, name: e.user.name, status: e.period?.status ?? 'open' }))} />
      <Card title="Vorschau Summen" className="mt-4" padded={false}>
        <div className="overflow-x-auto p-2">
          <table className="table min-w-[640px]">
            <thead>
              <tr>
                <th>Mitarbeiter:in</th>
                <th className="text-right">Soll</th>
                <th className="text-right">Ist</th>
                <th className="text-right">Normal</th>
                <th className="text-right">Mehrarbeit</th>
                <th className="text-right">ÜSt 50</th>
                <th className="text-right">ÜSt 100</th>
                <th className="text-right">Url./KS/ZA</th>
                <th className="text-right">Saldo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((e) => {
                const x = e.summary;
                const st = e.period?.status ?? 'open';
                return (
                  <tr key={e.user.id}>
                    <td className="font-medium">{e.user.name}</td>
                    <td className="text-right tabular-nums">{fmtH(x.targetMinutes)}</td>
                    <td className="text-right tabular-nums">{fmtH(x.workedMinutes)}</td>
                    <td className="text-right tabular-nums">{fmtH(Math.max(0, x.workedMinutes - x.overtimeMinutes - x.mehrarbeitMinutes))}</td>
                    <td className="text-right tabular-nums">{fmtH(x.mehrarbeitMinutes)}</td>
                    <td className="text-right tabular-nums">{fmtH(x.overtime50Minutes)}</td>
                    <td className="text-right tabular-nums">{fmtH(x.overtime100Minutes)}</td>
                    <td className="text-right tabular-nums">
                      {x.absenceDays.vacation}/{x.absenceDays.sick}/{x.absenceDays.time_comp}
                    </td>
                    <td className={`text-right tabular-nums ${x.balanceEndMinutes < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmtH(x.balanceEndMinutes, true)}</td>
                    <td>
                      <Badge tone={st === 'approved' || st === 'exported' ? 'green' : st === 'submitted' ? 'blue' : 'gray'}>{PERIOD_LABELS[st]}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
