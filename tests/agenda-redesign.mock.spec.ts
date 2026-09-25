import { expect, test } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { SignJWT } from 'jose';


loadEnvConfig(process.cwd());
const jwtSecret = process.env.JWT_SECRET || 'visual-test-secret-with-at-least-32-characters';
const today = '2026-09-15';

test.beforeEach(async ({ page, baseURL }) => {
  await page.clock.install({ time: new Date('2026-09-15T16:42:00Z') });
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  const token = await new SignJWT({ id: 'visual-admin', email: 'visual@sistema.test', rol: 'ADMIN' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(jwtSecret));

  await page.context().addCookies([{ name: 'access_token', value: token, url: baseURL!, httpOnly: true, sameSite: 'Lax' }]);
  await page.route('**/api/empleados/*/disponibilidad**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ slots: [], descansos: [], bloqueos: [] }) }));
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ usuario: { id: 'visual-admin', nombre: 'Administrador', email: 'visual@sistema.test', rol: 'ADMIN' } }),
  }));
  await page.route('**/api/servicios', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ servicios: [
      { id: '22222222-2222-4222-8222-222222222222', nombre: 'Corte y barba', duracion: 60, activo: true },
    ] }),
  }));
  await page.route('**/api/empleados?schedulable=true', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ empleados: [
      { id: 'visual-admin', nombre: 'Álvaro Zeledón' },
      { id: 'staff-2', nombre: 'Kevin Duarte' },
    ] }),
  }));
  await page.route('**/api/clientes**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ clientes: [{ id: 'client-1', nombre: 'José Pérez', telefono: '50588887777' }], total: 1 }),
  }));
  await page.route('**/api/citas?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ citas: [
      {
        id: 'appointment-1', fecha: today, hora: '08:30', duracion: 60, estado: 'CONFIRMADA',
        cliente_nombre: 'José Pérez', cliente_telefono: '50588887777', empleado_id: 'visual-admin',
        empleado: { id: 'visual-admin', nombre: 'Álvaro Zeledón' },
        servicio: { id: '22222222-2222-4222-8222-222222222222', nombre: 'Corte y barba' },
        citaServicios: [], updated_at: new Date().toISOString(),
      },
      {
        id: 'appointment-2', fecha: today, hora: '10:00', duracion: 30, estado: 'PENDIENTE',
        cliente_nombre: 'María López', cliente_telefono: null, empleado_id: 'staff-2',
        empleado: { id: 'staff-2', nombre: 'Kevin Duarte' },
        servicio: { id: '22222222-2222-4222-8222-222222222222', nombre: 'Corte' },
        citaServicios: [], updated_at: new Date().toISOString(),
      },
    ] }),
  }));
  await page.route('**/api/gestion/citas/sincronizar-estados', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ updated: 0 }),
  }));
});

test('Agenda es la vista inicial y conserva la cuadrícula horaria responsive', async ({ page }, testInfo) => {
  await page.goto('/citas');
  await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('button', { name: 'Todos', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('main').getByRole('button', { name: 'Agenda', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('main').getByRole('button', { name: 'Lista', exact: true })).toBeVisible();
  await expect(page.locator('.agenda-week-strip [aria-current=date]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Libro de citas')).toHaveCount(0);
  const controls = await page.locator('.agenda-calendar-controls').boundingBox();
  expect(controls!.height).toBeLessThanOrEqual(124);
  const workspace = await page.locator('.agenda-time-workspace').boundingBox();
  expect(workspace!.height).toBeGreaterThanOrEqual(page.viewportSize()!.height * 0.65);
  await expect(page.locator('[data-current-time-indicator]')).toContainText('10:42');
  await expect(page.getByRole('button', { name: /Nueva cita/i }).first()).toBeVisible();
  await expect(page.locator('.booking-card').filter({ hasText: 'José Pérez' })).toBeVisible();
  await expect(page.locator('.booking-card').filter({ hasText: 'Corte y barba' })).toBeVisible();
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0);

  const width = await page.locator('html').evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);

  if (process.env.CAPTURE_VISUALS === 'true') {
    const suffix = testInfo.project.name.includes('Mobile') ? 'mobile' : 'desktop';
    await page.screenshot({ path: `audit-screenshots/internal/14-agenda-compact-${suffix}.png`, fullPage: true });
  }

  const dayView = page.getByRole('button', { name: 'Día', exact: true });
  await dayView.click();
  await expect(dayView).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Día', exact: true })).toHaveAttribute('aria-pressed', 'true');
});


test('La barra cambia vistas, fechas y abre el formulario', async ({ page }, testInfo) => {
  await page.goto('/citas');
  const bar = page.getByRole('button', { name: /Cambiar vista:/ });
  await bar.click();
  const sheet = page.getByRole('dialog', { name: 'Vista y fecha de la agenda' });
  await expect(sheet).toBeVisible();
  await expect.poll(async () => { const box = await sheet.boundingBox(); return Math.round(box!.y + box!.height); }).toBeLessThanOrEqual(page.viewportSize()!.height);
  await expect(sheet.locator('.agenda-mini-grid button')).toHaveCount(35);
  await sheet.getByRole('button', { name: 'Mes anterior', exact: true }).click();
  await expect(sheet.locator('.agenda-mini-grid button')).toHaveCount(42);
  await sheet.getByRole('button', { name: 'Mes siguiente', exact: true }).click();
  if (process.env.CAPTURE_VISUALS === 'true') await page.screenshot({ path: `audit-screenshots/internal/14-agenda-sheet-${testInfo.project.name.includes('Mobile') ? 'mobile' : 'desktop'}.png` });
  await sheet.getByRole('button', { name: 'Mes', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('region', { name: 'Citas del mes' })).toBeVisible();
  await expect(page.locator('.agenda-month-booking').filter({ hasText: 'José Pérez' })).toBeVisible();
  await bar.click();
  await sheet.getByRole('button', { name: 'Calendario', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Calendario mensual' })).toBeVisible();
  await bar.click();
  await sheet.getByRole('button', { name: 'Mes siguiente', exact: true }).click();
  await expect(sheet.locator('.agenda-month-heading')).toContainText('octubre de 2026');
  await sheet.locator('[data-date="2026-10-01"]').click();
  await expect(page.locator('.agenda-week-strip [aria-pressed=true]')).toHaveAttribute('data-date', '2026-10-01');
  await bar.click();
  await sheet.getByRole('button', { name: 'Hoy', exact: true }).click();
  await bar.click();
  await sheet.getByRole('button', { name: 'Día', exact: true }).click();
  await expect(page.locator('[data-calendar-scroll]')).toBeVisible();
  await bar.click();
  await sheet.getByRole('button', { name: 'Cerrar selector de vista' }).click();
  await expect(bar).toBeFocused();
  await page.getByRole('button', { name: 'Nueva cita', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Nueva cita', exact: true })).toBeVisible();
});

test('Navegación, filtros y hora actual permanecen sincronizados', async ({ page }) => {
  await page.goto('/citas');
  await expect(page.locator('.booking-card').first()).toBeVisible();
  await page.getByRole('button', { name: 'Periodo siguiente' }).click();
  await expect(page.locator('.agenda-week-strip [aria-pressed=true]')).toHaveAttribute('data-date', '2026-09-18');
  await expect(page.locator('[data-current-time-indicator]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Periodo anterior' }).click();
  await page.getByRole('button', { name: 'Semana siguiente' }).click();
  await expect(page.locator('.agenda-week-strip [aria-pressed=true]')).toHaveAttribute('data-date', '2026-09-22');
  await page.getByRole('button', { name: 'Semana anterior' }).click();
  await page.getByRole('main').getByRole('button', { name: 'Todos', exact: true }).click();
  await page.getByRole('group', { name: 'Filtrar profesionales' }).getByRole('button', { name: 'Kevin' }).click();
  await expect(page.locator('.booking-card').filter({ hasText: 'José Pérez' })).toHaveCount(0);
  await expect(page.locator('.booking-card[title*="María López"]')).toBeVisible();
  await page.getByRole('group', { name: 'Filtrar profesionales' }).getByRole('button', { name: 'Todos(2)' }).click();
  await expect(page.locator('.booking-card').filter({ hasText: 'José Pérez' })).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(page.locator('[data-current-time-indicator]')).toContainText('10:43');
  await page.getByRole('main').getByRole('button', { name: 'Lista', exact: true }).click();
  await expect(page.locator('.agenda-floating-bar')).toHaveCount(0);
  await page.getByRole('main').getByRole('button', { name: 'Agenda', exact: true }).click();
  await expect(page.locator('.agenda-floating-bar')).toBeVisible();
});


test('Gestos táctiles cambian periodos sin abrir ni mover citas', async ({ page, context }, testInfo) => {
  test.skip(!testInfo.project.name.includes('Mobile'), 'Gestos táctiles en móvil');
  await page.goto('/citas');
  await expect(page.locator('.booking-card').first()).toBeVisible();
  const cdp = await context.newCDPSession(page);
  const swipe = async (x: number, y: number, dx: number, dy = 0) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 5; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 5, y: y + dy * step / 5 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await swipe(300, 500, -150);
  await expect(page.locator('.agenda-week-strip [aria-pressed=true]')).toHaveAttribute('data-date', '2026-09-18');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.agenda-floating-bar')).toBeVisible();
  await page.getByRole('button', { name: 'Día', exact: true }).click();
  await swipe(100, 500, 150);
  await expect(page.locator('.agenda-week-strip [aria-pressed=true]')).toHaveAttribute('data-date', '2026-09-17');
  await page.getByRole('button', { name: 'Sem', exact: true }).click();
  await swipe(300, 500, -150);
  await expect(page.locator('.agenda-week-strip [aria-pressed=true]')).toHaveAttribute('data-date', '2026-09-24');
  await swipe(300, 75, -150);
  await expect(page.locator('.agenda-week-strip [aria-pressed=true]')).toHaveAttribute('data-date', '2026-10-01');
  await swipe(200, 550, 0, -120);
  await expect(page.locator('.agenda-week-strip [aria-pressed=true]')).toHaveAttribute('data-date', '2026-10-01');
  await page.getByRole('button', { name: /Cambiar vista:/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Vista y fecha de la agenda' });
  await expect(sheet).toBeVisible();
  await expect.poll(async () => { const box = await sheet.boundingBox(); return Math.round(box!.y + box!.height); }).toBeLessThanOrEqual(844);
  const box = await sheet.boundingBox();
  await swipe(160, box!.y + 15, 0, 300);
  await expect(sheet).toBeHidden();
});


test('El mes carga páginas adicionales y Nueva cita inicia con la fecha predeterminada', async ({ page }) => {
  const cursors: Array<string | null> = [];
  let submittedDate = '';
  await page.route('**/api/empleados/*/disponibilidad**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    disponible: true, bloques: [], jornada: { inicio: '08:00', fin: '18:00' }, intervalosOcupados: [],
  }) }));
  await page.route('**/api/citas', async route => {
    const payload = route.request().postDataJSON();
    submittedDate = payload.fecha;
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
      cita: { id: 'new-appointment', ...payload, duracion: 60, estado: 'PENDIENTE' },
    }) });
  });
  await page.route('**/api/citas?**', route => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    cursors.push(cursor);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      citas: cursor ? [{ id: 'last-page', fecha: today, hora: '09:00', duracion: 60, estado: 'PENDIENTE', cliente_nombre: 'Última página', empleado_id: 'visual-admin' }] : [],
      nextCursor: cursor ? null : 'page-two',
    }) });
  });
  await page.goto('/citas');
  await expect(page.locator('.booking-card').filter({ hasText: 'Última página' })).toBeVisible();
  expect(cursors).toContain('page-two');
  await page.getByRole('button', { name: /Cambiar vista:/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Vista y fecha de la agenda' });
  await sheet.locator('[data-date="2026-09-11"]').click();
  await page.getByRole('button', { name: 'Nueva cita', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Nueva cita', exact: true });
  await expect(form.locator('input[type=date]')).toHaveValue(today);
  await form.getByPlaceholder('Buscar por nombre, teléfono o correo...').fill('José');
  await form.getByRole('button', { name: /José Pérez/ }).click();
  await form.locator('select').first().selectOption('22222222-2222-4222-8222-222222222222');
  await form.getByRole('button', { name: 'Crear Cita' }).click();
  await expect.poll(() => submittedDate).toBe(today);
  await expect(page.locator('.agenda-week-strip [aria-pressed=true]')).toHaveAttribute('data-date', today);
});
