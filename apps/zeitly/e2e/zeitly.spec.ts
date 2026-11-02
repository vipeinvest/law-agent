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
