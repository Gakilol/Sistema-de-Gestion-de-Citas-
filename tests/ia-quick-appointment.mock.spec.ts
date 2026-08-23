import { expect, test } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { SignJWT } from 'jose';

loadEnvConfig(process.cwd());
const jwtSecret = process.env.JWT_SECRET || 'visual-test-secret-with-at-least-32-characters';

test.beforeEach(async ({ page, baseURL }) => {
  const token = await new SignJWT({ id: 'visual-admin', email: 'visual@sistema.test', rol: 'ADMIN' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(jwtSecret));

  await page.context().addCookies([{ name: 'access_token', value: token, url: baseURL!, httpOnly: true, sameSite: 'Lax' }]);
  await page.route('**/api/servicios', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ servicios: [
      { id: '22222222-2222-4222-8222-222222222222', nombre: 'Corte clásico', duracion: 30, activo: true },
      { id: '33333333-3333-4333-8333-333333333333', nombre: 'Corte y barba', duracion: 60, activo: true },
    ] }),
  }));
  await page.route('**/api/empleados?schedulable=true', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ empleados: [{ id: 'staff-1', nombre: 'Álvaro Zeledón' }] }),
  }));
  await page.route('**/api/clientes?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ clientes: [] }),
  }));
});

test('muestra una plantilla clara, exacta y sin desbordamiento', async ({ page }) => {
  await page.goto('/ia');
  await page.getByRole('button', { name: 'Crear cita con IA' }).click();

  await expect(page.getByRole('heading', { name: 'Crear una cita sin adivinar datos' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Busca por nombre o teléfono' }).fill('Cliente nuevo');
  await expect(page.getByText(/No está guardado. Regístralo antes/i)).toBeVisible();

  await page.getByRole('textbox', { name: 'Escribe el servicio' }).fill('Corte');
  await expect(page.getByRole('option', { name: /Corte clásico/i })).toBeVisible();
  await expect(page.getByRole('option', { name: /Corte y barba/i })).toBeVisible();

  const widths = await page.locator('html').evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1);
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0);
});
