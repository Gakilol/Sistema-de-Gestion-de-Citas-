import { expect, test, type CDPSession } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { SignJWT } from 'jose';

loadEnvConfig(process.cwd());
const jwtSecret = process.env.JWT_SECRET || 'visual-test-secret-with-at-least-32-characters';
const today = '2026-11-16';
const employees = ['admin', 'staff-2', 'staff-3'].map((id, i) => ({ id, nombre: `Profesional ${i + 1}` }));
const appointments = Array.from({ length: 10 }, (_, i) => ({
  id: `appointment-${i}`, fecha: `${today}T00:00:00.000Z`, hora: `${String(8 + i).padStart(2, '0')}:00`,
  duracion: 30, estado: 'CONFIRMADA', cliente_nombre: `Cliente ${i}`, empleado_id: 'admin',
  empleado: employees[0], servicio: { nombre: 'Corte' }, citaServicios: [], updated_at: '2026-11-16T13:00:00Z',
}));

async function swipe(cdp: CDPSession, dx: number, dy = 0, x = dx < 0 ? 300 : 100, y = 460) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let step = 1; step <= 8; step++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: x + dx * step / 8, y: y + dy * step / 8 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.beforeEach(async ({ page, baseURL }) => {
  await page.clock.install({ time: new Date('2026-11-16T19:19:00Z') });
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('novacita_calendar_view', 'semana');
  });
  const token = await new SignJWT({ id: 'admin', email: 'calendar@test.local', rol: 'ADMIN' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('15m')
    .sign(new TextEncoder().encode(jwtSecret));
  await page.context().addCookies([{ name: 'access_token', value: token, url: baseURL!, httpOnly: true, sameSite: 'Lax' }]);
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    let data: object = {};
    if (url.pathname === '/api/auth/me') data = { usuario: { ...employees[0], email: 'calendar@test.local', rol: 'ADMIN' } };
    if (url.pathname === '/api/empleados') data = { empleados: employees };
    if (url.pathname === '/api/servicios') data = { servicios: [{ id: 'service', nombre: 'Corte', duracion: 30, activo: true }] };
    if (url.pathname === '/api/clientes') data = { clientes: [], total: 0 };
    if (url.pathname === '/api/citas') data = { citas: appointments, nextCursor: null };
    if (url.pathname.endsWith('/sincronizar-estados')) data = { updated: 0 };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
});

test('Recorrer días y profesionales conserva las diez citas y la semana seleccionada', async ({ page, context }, testInfo) => {
  test.skip(!testInfo.project.name.includes('Mobile'), 'Desplazamiento táctil en móvil');
  await page.goto('/citas');
  const grid = page.locator('[data-calendar-scroll]');
  const selected = page.locator('.agenda-week-strip [aria-pressed=true]');
  await expect(page.locator('.booking-card')).toHaveCount(10);
  const cdp = await context.newCDPSession(page);
  const mutations: string[] = [];
  page.on('request', request => {
    if (/\/api\/citas(?:\?|\/|$)/.test(request.url()) && request.method() !== 'GET') mutations.push(request.method());
  });
  await swipe(cdp, -150);
  await expect.poll(() => grid.evaluate(el => el.scrollLeft)).toBeGreaterThan(50);
  await expect(selected).toHaveAttribute('data-date', today);
  await expect(page.locator('.booking-card')).toHaveCount(10);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.provisional-card')).toHaveCount(0);
  await grid.evaluate(el => { el.scrollLeft = 500; });
  await swipe(cdp, 150);
  await expect.poll(() => grid.evaluate(el => el.scrollLeft)).toBeLessThan(480);
  await expect(selected).toHaveAttribute('data-date', today);
  await expect(page.locator('.booking-card')).toHaveCount(10);
  expect(mutations).toEqual([]);
});

test('Lunes a domingo y último día a lunes siguiente continúan por los extremos', async ({ page, context }, testInfo) => {
  test.skip(!testInfo.project.name.includes('Mobile'), 'Desplazamiento táctil en móvil');
  await page.goto('/citas');
  const grid = page.locator('[data-calendar-scroll]');
  const selected = page.locator('.agenda-week-strip [aria-pressed=true]');
  await expect(page.locator('.booking-card')).toHaveCount(10);
  const cdp = await context.newCDPSession(page);
  const scrollTop = await grid.evaluate(el => el.scrollTop);
  await swipe(cdp, 150);
  await expect(selected).toHaveAttribute('data-date', '2026-11-15');
  await expect(grid.locator('[data-day-str="2026-11-15"]').first()).toBeInViewport();
  await expect(page.locator('.booking-card')).toHaveCount(10);
  expect(await grid.evaluate(el => el.scrollTop)).toBeCloseTo(scrollTop, 0);

  await page.getByRole('button', { name: 'Semana siguiente', exact: true }).click();
  await page.locator('.agenda-week-strip [data-date="2026-11-16"]').click();
  await expect(selected).toHaveAttribute('data-date', today);
  await expect(page.locator('.booking-card')).toHaveCount(10);
  await grid.evaluate(el => { el.scrollLeft = el.scrollWidth - el.clientWidth; });
  await swipe(cdp, -150);
  await expect(selected).toHaveAttribute('data-date', '2026-11-17');
  await expect(grid.locator('[data-day-str="2026-11-23"]').last()).toBeInViewport();
  await expect.poll(() => grid.evaluate(el => el.scrollWidth - el.clientWidth - el.scrollLeft)).toBeLessThanOrEqual(2);
  await page.locator('.agenda-week-strip [data-date="2026-11-16"]').click();
  await expect(grid.locator('[data-day-str="2026-11-16"]').first()).toBeInViewport();
  await expect(page.locator('.booking-card')).toHaveCount(10);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Desplazamiento vertical, cancelación y pellizco no cambian la fecha ni las citas', async ({ page, context }, testInfo) => {
  test.skip(!testInfo.project.name.includes('Mobile'), 'Desplazamiento táctil en móvil');
  await page.goto('/citas');
  const selected = page.locator('.agenda-week-strip [aria-pressed=true]');
  await expect(page.locator('.booking-card')).toHaveCount(10);
  const cdp = await context.newCDPSession(page);
  await swipe(cdp, 0, -120, 180, 550);
  await expect(selected).toHaveAttribute('data-date', today);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 450 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 250, y: 450 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(selected).toHaveAttribute('data-date', today);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 450 }, { x: 250, y: 500 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 80, y: 430 }, { x: 280, y: 520 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(selected).toHaveAttribute('data-date', today);
  await expect(page.locator('.booking-card')).toHaveCount(10);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Los controles de semana cruzan mes y año y permiten recuperar las citas sin recargar', async ({ page }) => {
  await page.goto('/citas');
  await expect(page.locator('.booking-card')).toHaveCount(10);
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Semana siguiente', exact: true }).click();
  await expect(page.locator('.agenda-week-strip [aria-pressed=true]')).toHaveAttribute('data-date', '2027-01-04');
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Semana anterior', exact: true }).click();
  await expect(page.locator('.agenda-week-strip [aria-pressed=true]')).toHaveAttribute('data-date', today);
  await expect(page.locator('.booking-card')).toHaveCount(10);
});
