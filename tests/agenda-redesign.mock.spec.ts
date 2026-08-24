import { expect, test } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { SignJWT } from 'jose';
import { getBusinessTodayString } from '../lib/timezone';

loadEnvConfig(process.cwd());
const jwtSecret = process.env.JWT_SECRET || 'visual-test-secret-with-at-least-32-characters';
const today = getBusinessTodayString();

test.beforeEach(async ({ page, baseURL }) => {
  const token = await new SignJWT({ id: 'visual-admin', email: 'visual@sistema.test', rol: 'ADMIN' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(jwtSecret));

  await page.context().addCookies([{ name: 'access_token', value: token, url: baseURL!, httpOnly: true, sameSite: 'Lax' }]);
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
  await expect(page.getByRole('main').getByRole('button', { name: 'Agenda', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('main').getByRole('button', { name: 'Lista', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hoy', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Nueva cita/i }).first()).toBeVisible();
  await expect(page.locator('.booking-card').filter({ hasText: 'José Pérez' })).toBeVisible();
  await expect(page.locator('.booking-card').filter({ hasText: 'Corte y barba' })).toBeVisible();
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0);

  const width = await page.locator('html').evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);

  if (process.env.CAPTURE_VISUALS === 'true') {
    const suffix = testInfo.project.name.includes('Mobile') ? 'mobile' : 'desktop';
    await page.screenshot({ path: `audit-screenshots/internal/13-agenda-reference-${suffix}.png`, fullPage: true });
  }

  const dayView = page.getByRole('button', { name: 'Día', exact: true });
  await dayView.click();
  await expect(dayView).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Día', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
