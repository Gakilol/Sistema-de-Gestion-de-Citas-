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
  await page.route('**/api/ia/chat', async (route) => {
    const body = route.request().postDataJSON();
    const latest = body.messages.at(-1);
    if (latest?.content.includes('José López') && !latest?.appointmentDraft?.clienteId) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          text: 'Encontré más de un cliente. ¿Cuál deseas usar?',
          toolsUsed: ['prepareCreateAppointment'],
          appointmentDraft: { cliente: 'José López', servicio: 'Corte', profesional: 'Álvaro', fecha: '2026-08-25', hora: '09:00' },
          choiceRequest: {
            kind: 'client',
            prompt: 'Encontré más de un cliente. ¿Cuál deseas usar?',
            appointmentDraft: { cliente: 'José López', servicio: 'Corte', profesional: 'Álvaro', fecha: '2026-08-25', hora: '09:00' },
            options: [
              { id: '11111111-1111-4111-8111-111111111111', label: 'José López', description: 'Tel. 88881111' },
              { id: '22222222-2222-4222-8222-222222222222', label: 'José López', description: 'Tel. 88882222' },
            ],
          },
        }),
      });
      return;
    }
    if (latest?.appointmentDraft?.clienteId) {
      expect(latest.appointmentDraft.clienteId).toBe('22222222-2222-4222-8222-222222222222');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          text: 'Cliente verificado. Revisa el resumen antes de guardar.',
          toolsUsed: ['prepareCreateAppointment'],
          pendingAction: {
            type: 'CREATE_APPOINTMENT',
            title: 'Crear cita',
            description: 'El horario está disponible. Confirma para guardarlo en la agenda.',
            confirmLabel: 'Sí, crear cita',
            endpoint: '/api/citas',
            method: 'POST',
            body: {},
            details: [
              { label: 'Cliente', value: 'José López' },
              { label: 'Teléfono', value: '88882222' },
              { label: 'Hora', value: '09:00' },
            ],
          },
        }),
      });
      return;
    }
    expect(latest?.content).toBe('Agenda a Carlos mañana a las 9 para corte con Álvaro.');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text: 'Encontré los datos reales. Revisa el resumen antes de crear la cita.', toolsUsed: ['prepareCreateAppointment'] }),
    });
  });
});

test('acepta una instrucción natural sin plantilla ni desbordamiento', async ({ page }) => {
  await page.goto('/ia');
  await page.getByRole('button', { name: 'Escribir cita rápida' }).click();
  const input = page.getByRole('textbox', { name: 'Mensaje para el asistente' });
  await expect(input).toBeFocused();
  await input.fill('Agenda a Carlos mañana a las 9 para corte con Álvaro.');
  await input.press('Enter');
  await expect(page.getByText(/Encontré los datos reales/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Crear una cita sin adivinar datos' })).toHaveCount(0);

  const widths = await page.locator('html').evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1);
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0);
});

test('permite escoger visualmente entre clientes con el mismo nombre', async ({ page }, testInfo) => {
  await page.goto('/ia');
  await page.getByRole('button', { name: 'Escribir cita rápida' }).click();
  const input = page.getByRole('textbox', { name: 'Mensaje para el asistente' });
  await input.fill('Agenda a José López mañana a las 9 para corte con Álvaro.');
  await input.press('Enter');

  await expect(page.getByText('Revisa el dato secundario antes de continuar. No se guardará nada todavía.')).toBeVisible();
  await page.getByRole('button', { name: /José López Tel\. 88882222/ }).click();

  await expect(page.getByRole('heading', { name: 'Crear cita' })).toBeVisible();
  await expect(page.getByText('88882222', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sí, crear cita' })).toBeVisible();

  if (process.env.CAPTURE_VISUALS === 'true') {
    const suffix = testInfo.project.name.includes('Mobile') ? 'mobile' : 'desktop';
    await page.screenshot({ path: `audit-screenshots/internal/14-ia-client-choice-${suffix}.png`, fullPage: true });
  }
});
