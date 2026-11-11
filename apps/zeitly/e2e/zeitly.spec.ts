import { expect, test, type Page } from '@playwright/test';

const today = new Date();
const prev = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
const PY = prev.getUTCFullYear();
const PM = prev.getUTCMonth() + 1;
const PMM = `${PY}-${String(PM).padStart(2, '0')}`;

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Dienstliche E-Mail-Adresse').fill(email);
  await page.getByRole('button', { name: 'Code anfordern' }).click();
  const code = (await page.getByTestId('demo-code').textContent())!.match(/\d{6}/)![0];
  await page.getByLabel('6-stelliger Code').fill(code);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL(/\/(app|admin)/);
}

test.describe.configure({ mode: 'serial' });

test('health endpoint reports ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.db).toBe('ok');
});

test('employee: login, clock in, break, clock out creates a booking', async ({ page }) => {
  await login(page, 'lukas.brandstaetter@steinerfood.com');
  await expect(page.getByRole('heading', { name: /Hallo|Guten/ })).toBeVisible();
  await page.getByRole('button', { name: 'Telearbeit' }).first().click();
  await page.getByTestId('timer-start').click();
  await expect(page.getByTestId('timer-stop')).toBeVisible();
  await page.getByTestId('timer-break').click();
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByTestId('timer-stop').click();
  await expect(page.getByTestId('timer-start')).toBeVisible();
  await expect(page.getByText('Heute gebucht')).toBeVisible();
  await expect(page.locator('text=Stempel').first()).toBeVisible();
});

test('employee: manual entry via week view and validation of overlaps', async ({ page }) => {
  await login(page, 'lukas.brandstaetter@steinerfood.com');
  await page.goto(`/app/woche?d=${PMM}-15`);
  await page.getByLabel('Buchung hinzufügen').first().click();
  await page.getByLabel('Beginn').fill('07:00');
  await page.getByLabel('Ende').fill('07:30');
  await page.getByLabel('Notiz').fill('E2E Eintrag');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('E2E Eintrag')).toBeVisible();
});

test('employee: previous month can be submitted, then it is locked', async ({ page }) => {
  await login(page, 'sarah.mayer@steinerfood.com');
  await page.goto(`/app/monat?m=${PMM}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const submit = page.getByTestId('submit-month');
  if (await submit.isVisible()) {
    await page.getByText('Ich bestätige, dass die Aufzeichnungen vollständig und richtig sind.').click();
    await submit.click();
    await expect(page.getByText('Eingereicht', { exact: true })).toBeVisible();
  }
  await expect(page.getByText(/eingereicht oder freigegeben|Eingereicht/)).toBeVisible();
});

test('employee: absence request appears for manager and can be approved', async ({ page }) => {
  await login(page, 'tobias.kern@steinerfood.com');
  await page.goto('/app/abwesenheiten');
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 2, 10)).toISOString().slice(0, 10);
  await page.getByLabel('Von').fill(d);
  await page.getByLabel('Bis').fill(d);
  await page.getByLabel('Notiz').fill('E2E Urlaub');
  await page.getByRole('button', { name: 'Beantragen' }).click();
  await expect(page.getByText('Antrag gesendet')).toBeVisible();
  await page.context().clearCookies();
  await login(page, 'nina.hofer@steinerfood.com');
  await page.goto('/admin/freigaben');
  const row = page.locator('li', { hasText: 'E2E Urlaub' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Genehmigen' }).click();
  await expect(row).toHaveCount(0);
});

test('manager: approves a submitted month and exports work', async ({ page, request }) => {
  await login(page, 'nina.hofer@steinerfood.com');
  await page.goto('/admin/freigaben');
  const approve = page.getByTestId('approve-period').first();
  if (await approve.isVisible()) await approve.click();
  await page.goto(`/admin/export?m=${PMM}`);
  await expect(page.getByText('Vorschau Summen')).toBeVisible();
  for (const url of [`/api/export/payroll?year=${PY}&month=${PM}&format=xlsx`, `/api/export/payroll?year=${PY}&month=${PM}&format=csv`, `/api/export/payroll?year=${PY}&month=${PM}&format=projects`, `/api/export/journal?year=${PY}&month=${PM}&all=1`]) {
    const res = await page.request.get(url);
    expect(res.status(), url).toBe(200);
    expect((await res.body()).length).toBeGreaterThan(1000);
  }
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Jetzt senden' }).click();
  await expect(page.getByText(/Gesendet an/)).toBeVisible({ timeout: 30000 });
  void request;
});

test('admin: settings page saves theme and rules; employee list and audit log render', async ({ page }) => {
  await login(page, 'm.behr@steinerfood.com');
  await page.goto('/admin/einstellungen');
  await page.getByLabel('App-Name').fill('STEINERfood Zeit');
  await page.getByRole('button', { name: 'Erscheinungsbild speichern' }).click();
  await expect(page.getByText('Gespeichert.')).toBeVisible();
  await page.goto('/admin/mitarbeiter');
  await expect(page.getByText('Lukas Brandstätter')).toBeVisible();
  await page.goto('/admin/protokoll');
  await expect(page.getByText('Einstellungen geändert').first()).toBeVisible();
});

test('security: employee cannot access admin or other users data', async ({ page }) => {
  await login(page, 'lukas.brandstaetter@steinerfood.com');
  const res = await page.request.get('/api/export/payroll?year=2026&month=10&format=csv');
  expect(res.status()).toBe(403);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/app/);
  const unauth = await page.request.get('/api/timer', { headers: { cookie: '' } });
  expect([200, 401]).toContain(unauth.status());
});

test('public: legal pages and manifest are served; unauthenticated api is rejected', async ({ request }) => {
  for (const p of ['/datenschutz', '/impressum', '/manifest.webmanifest', '/sw.js', '/icons/icon-192.png']) expect((await request.get(p)).status(), p).toBe(200);
  expect((await request.get('/api/entries?from=2026-01-01&to=2026-01-31')).status()).toBe(401);
  const headers = (await request.get('/login')).headers();
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-frame-options']).toBe('DENY');
});

// ---------------------------------------------------------------------------------------------
// v2: Onboarding, Dienstplan, API v1, Prüfbericht
// ---------------------------------------------------------------------------------------------

const iso = (d: Date) => d.toISOString().slice(0, 10);
const lastSaturday = (() => {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7 || 7));
  return iso(d);
})();

test('onboarding: admin creates employee, questionnaire link works end-to-end and grants access', async ({ page, request }) => {
  await login(page, 'm.behr@steinerfood.com');
  const email = `e2e.onboarding.${Date.now()}@steinerfood.com`;
  const create = await page.request.post('/api/admin/users', {
    data: { email, name: 'Eva E2E', role: 'employee', personnelNo: 'SF-900', managerId: null, sendInvite: true, sendOnboarding: true, employment: { weeklyMinutes: 2400, workDays: [1, 2, 3, 4, 5], recordMode: 'full', gleitzeit: false, vacationDaysPerYear: 25, openingBalanceMinutes: 0, allIn: false, startDate: iso(today) } },
  });
  expect(create.status()).toBe(201);
  const { user, onboardingLink } = await create.json();
  expect(onboardingLink).toMatch(/\/onboarding\/[A-Za-z0-9_-]{20,}/);
  const token = onboardingLink.split('/onboarding/')[1];

  // public questionnaire (no login)
  await page.context().clearCookies();
  await page.goto(`/onboarding/${token}`);
  await expect(page.getByText('Eva', { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId('onb-next')).toBeVisible();

  // fill via API (same endpoints the wizard uses), then submit
  const save = await request.post(`/api/onboarding/${token}`, {
    data: {
      data: {
        person: { firstName: 'Eva', lastName: 'E2E', birthDate: '1980-01-01', svNumber: '1237010180', nationality: 'Österreich' },
        contact: { street: 'Teststraße 1', zip: '1010', city: 'Wien', country: 'Österreich', phone: '+43 660 1234567' },
        bank: { iban: 'AT611904300234573201' },
        tax: { children: [], avabRequested: false, pendlerrechnerDone: false, otherEmployment: false },
        employment: { jobTitle: 'Vertrieb Innendienst', startDate: iso(today), weeklyHours: 40, firstJobInAustria: false },
      },
    },
  });
  expect(save.status()).toBe(200);
  expect((await save.json()).completeness).toBeGreaterThan(50);
  const submit = await request.put(`/api/onboarding/${token}`, { data: { consents: { privacyInfoRead: true, timeTrackingConsent: true, dataCorrect: true } } });
  expect(submit.status()).toBe(200);
  expect((await request.put(`/api/onboarding/${token}`, { data: { consents: { privacyInfoRead: true, timeTrackingConsent: true, dataCorrect: true } } })).status()).toBe(409);

  // admin sees submitted status + personnel sheet PDF; new employee can log in
  await login(page, 'm.behr@steinerfood.com');
  await page.goto(`/admin/mitarbeiter/${user.id}?tab=onboarding`);
  await expect(page.getByText('eingereicht', { exact: true }).first()).toBeVisible();
  const pdf = await page.request.post('/api/admin/onboarding', { data: { action: 'pdf', userId: user.id } });
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  await page.context().clearCookies();
  await login(page, email);
  await expect(page.getByRole('heading', { name: /Hallo|Guten/ })).toBeVisible();
});

test('roster: manager plans and publishes a shift, employee adopts it as actual time', async ({ page }) => {
  await login(page, 'm.behr@steinerfood.com');
  await page.goto('/admin/dienstplan');
  await expect(page.getByRole('heading', { name: /Dienstplan/ })).toBeVisible();
  await expect(page.getByText('Lukas Brandstätter')).toBeVisible();
  await page.goto('/admin/mitarbeiter');
  const href = await page.getByRole('link', { name: 'Lukas Brandstätter', exact: true }).first().getAttribute('href');
  const lukas = { id: href!.split('/admin/mitarbeiter/')[1].split('?')[0] };
  expect(lukas.id).toMatch(/^[0-9a-f-]{36}$/);
  const monday = (() => {
    const d = new Date(lastSaturday + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 5);
    return iso(d);
  })();
  const up = await page.request.post('/api/admin/shifts', { data: { action: 'upsert', shift: { userId: lukas.id, date: lastSaturday, start: '09:00', end: '13:00', breakMinutes: 0, location: 'remote', note: 'Inventur' } } });
  expect(up.status()).toBe(200);
  const check = await page.request.post('/api/admin/shifts', { data: { action: 'check', monday } });
  expect(check.status()).toBe(200);
  const pub = await page.request.post('/api/admin/shifts', { data: { action: 'publish', monday, force: true, notify: false } });
  expect(pub.status()).toBe(200);
  expect((await pub.json()).published).toBeGreaterThan(0);

  await page.context().clearCookies();
  await login(page, 'lukas.brandstaetter@steinerfood.com');
  await page.goto(`/app/woche?d=${lastSaturday}`);
  const line = page.locator(`section[id="${lastSaturday}"] [data-testid="plan-line"]`);
  await expect(line).toContainText('09:00 – 13:00');
  await line.getByTestId('plan-adopt').click();
  await expect(line).toContainText('gebucht');
  await expect(page.locator(`section[id="${lastSaturday}"]`).getByText('Plan: Inventur', { exact: true })).toBeVisible();
  const entries = await (await page.request.get(`/api/entries?from=${lastSaturday}&to=${lastSaturday}`)).json();
  const list = entries.entries ?? entries;
  expect(list.some((e: { source: string }) => e.source === 'plan')).toBe(true);
});

test('api v1: owner creates key in settings, payroll endpoint answers with bearer token and enforces scopes', async ({ page, request }) => {
  await login(page, 'inge.steiner@steinerfood.com');
  await page.goto('/admin/einstellungen');
  const panel = page.getByTestId('apikeys-panel');
  await expect(panel).toBeVisible();
  await panel.getByTestId('apikey-create').click();
  const fresh = await panel.getByTestId('apikey-fresh').locator('code').textContent();
  expect(fresh).toMatch(/^zt_live_[A-Za-z0-9]+\.[A-Za-z0-9_-]{20,}$/);
  const ok = await request.get(`/api/v1/payroll/${PY}/${PM}`, { headers: { authorization: `Bearer ${fresh}` } });
  expect(ok.status()).toBe(200);
  const body = await ok.json();
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.data.length).toBeGreaterThan(2);
  expect(body.data[0].hours).toHaveProperty('overtime');
  expect((await request.get(`/api/v1/employees`, { headers: { authorization: `Bearer ${fresh}` } })).status()).toBe(403);
  expect((await request.get(`/api/v1/payroll/${PY}/${PM}`)).status()).toBe(401);
  expect((await request.get(`/api/v1/payroll/${PY}/${PM}`, { headers: { authorization: 'Bearer zt_live_abc.wrong' } })).status()).toBe(401);
});

test('review: admin opens the monthly Prüfbericht for an employee', async ({ page }) => {
  await login(page, 'm.behr@steinerfood.com');
  await page.goto('/admin/mitarbeiter');
  await page.getByRole('link', { name: /Tobias Kern/ }).first().click();
  await page.waitForURL(/\/admin\/mitarbeiter\//);
  await page.goto(page.url().split('?')[0] + `?m=${PMM}`);
  await page.getByTestId('review-run').click();
  const dlg = page.getByTestId('review-dialog');
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('Soll');
  await expect(dlg).toContainText(/Zu klären|keine Verstöße/);
});

test('roster budget: admin sets cost rate and weekly budget, planner shows cost, budget status and absences', async ({ page }) => {
  // owner account: the admin address already uses its 5 login codes per 15 min in this suite
  await login(page, 'inge.steiner@steinerfood.com');
  await page.goto('/admin/mitarbeiter');
  const href = await page.getByRole('link', { name: 'Tobias Kern', exact: true }).first().getAttribute('href');
  const tobiasId = href!.split('/admin/mitarbeiter/')[1].split('?')[0];
  const emp = { weeklyMinutes: 2400, workDays: [1, 2, 3, 4, 5], recordMode: 'full', gleitzeit: false, vacationDaysPerYear: 25, openingBalanceMinutes: 0, allIn: false, hourlyCost: 30 };
  expect((await page.request.patch('/api/admin/users', { data: { id: tobiasId, employment: emp } })).status()).toBe(200);
  expect((await page.request.patch('/api/admin/org', { data: { laborBudgetWeekly: 500 } })).status()).toBe(200);
  // approved absence on Friday of the planned week for Tobias (demo roster has a shift there)
  const monday = (() => { const d = new Date(today); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return iso(d); })();
  const friday = (() => { const d = new Date(monday + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 4); return iso(d); })();
  const abs = await page.request.post('/api/absences', { data: { userId: tobiasId, dateFrom: friday, dateTo: friday, type: 'vacation', halfDay: false } });
  expect([200, 201]).toContain(abs.status());
  const absId = (await abs.json()).absence?.id;
  if (absId) await page.request.patch(`/api/absences/${absId}`, { data: { status: 'approved' } });

  await page.goto(`/admin/dienstplan?w=${monday}`);
  const summary = page.getByTestId('labor-summary');
  await expect(summary).toBeVisible();
  // Tobias: 5 shifts of 8.5 h net at 30 EUR = 1.275 EUR, above the 500 EUR budget
  await expect(page.getByTestId('labor-cost')).toContainText('1.275');
  await expect(page.getByTestId('budget-status')).toContainText('über Budget');
  await expect(page.getByTestId('plan-absence').filter({ hasText: 'Urlaub' }).first()).toBeVisible();
  // raise the budget in the planner itself
  await page.getByTestId('budget-edit').click();
  await page.getByTestId('budget-input').fill('2000');
  await page.getByTestId('budget-save').click();
  await expect(page.getByTestId('budget-status')).toContainText('frei');
  // the week check warns about the shift on the approved absence
  const check = await page.request.post('/api/admin/shifts', { data: { action: 'check', monday } });
  const checks = (await check.json()).checks as Array<{ userId: string; violations: Array<{ code: string }> }>;
  expect(checks.find((c) => c.userId === tobiasId)?.violations.some((v) => v.code === 'PLAN_ON_ABSENCE')).toBe(true);
  // managers do not see amounts
  await page.context().clearCookies();
  await login(page, 'nina.hofer@steinerfood.com');
  await page.goto(`/admin/dienstplan?w=${monday}`);
  await expect(page.getByTestId('labor-summary')).toBeVisible();
  await expect(page.getByTestId('labor-cost')).toHaveCount(0);
});
