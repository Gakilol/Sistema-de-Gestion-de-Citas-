import { expect, test } from '@playwright/test';
import { SignJWT } from 'jose';

const employee = { id: '22222222-2222-4222-8222-222222222222', nombre: 'Profesional de prueba' };
const client = { id: '11111111-1111-4111-8111-111111111111', nombre: 'Cliente de prueba', telefono: '88889999' };
const service = { id: '33333333-3333-4333-8333-333333333333', nombre: 'Corte', duracion: 30 };

test.beforeEach(async ({ page, baseURL }) => {
  const token = await new SignJWT({ id: employee.id, email: 'assistant@test.local', rol: 'ADMIN' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('15m')
    .sign(new TextEncoder().encode('assistant-browser-test-only-secret-32-characters'));
  await page.context().addCookies([{ name: 'access_token', value: token, url: baseURL!, httpOnly: true, sameSite: 'Lax' }]);
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
    class MockRecognition {
      lang = ''; interimResults = false; continuous = false;
      onresult: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror = null;
      start() { setTimeout(() => { this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'Agenda corte mañana a las tres de la tarde' } }] }); this.onend?.(); }, 30); }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: MockRecognition, configurable: true });
  });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    let data: object;
    if (path === '/api/auth/me') data = { usuario: { ...employee, rol: 'ADMIN', email: 'assistant@test.local' } };
    else if (path === '/api/ia/contexto') data = { servicios: [service], empleados: [employee], baseCompartida: true };
    else if (path === '/api/ia/clientes') data = { clientes: [client] };
    else if (path === '/api/ia/chat') data = {
      text: 'Revisa el resumen y confirma la cita.', mode: 'local', fallbackReason: 'quota',
      draft: { id: '44444444-4444-4444-8444-444444444444', revision: 1, clienteId: client.id, clienteNombre: client.nombre, empleadoId: employee.id, profesionalNombre: employee.nombre, servicios: [service], fecha: '2027-01-01', hora: '15:00', expiresAt: new Date(Date.now() + 900000).toISOString(), listo: true, faltantes: [] },
    };
    else if (path === '/api/ia/citas/confirmar') data = { citaId: 'cita-creada', mensaje: 'Cita registrada correctamente.' };
    else throw new Error(`Unexpected API request in isolated assistant test: ${path}`);
    return route.fulfill({ status: path.endsWith('/confirmar') ? 201 : 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
});

test('dictar, revisar y confirmar registra solo después del botón', async ({ page }, testInfo) => {
  const confirmations: object[] = [];
  page.on('request', request => { if (request.url().endsWith('/api/ia/citas/confirmar')) confirmations.push(request.postDataJSON()); });
  await page.goto('/asistente');
  await expect(page.getByRole('heading', { name: 'Asistente NovaCita' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('Cliente');
  await page.getByRole('button', { name: /Cliente de prueba/ }).click();
  await page.getByLabel('Profesional', { exact: true }).selectOption(employee.id);
  await page.getByRole('button', { name: 'Iniciar dictado' }).click();
  await expect(page.getByRole('textbox', { name: 'Tu mensaje' })).toHaveValue('Agenda corte mañana a las tres de la tarde');
  expect(confirmations).toHaveLength(0);
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  const preview = page.getByRole('region', { name: 'Resumen de la cita' });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText(client.nombre);
  await expect(page.getByRole('button', { name: 'Confirmar cita' })).toBeEnabled();
  expect(confirmations).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/assistant-${testInfo.project.name.includes('Android') ? 'mobile' : 'desktop'}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Confirmar cita' }).click();
  await expect(page.getByRole('heading', { name: 'Cita registrada' })).toBeVisible();
  expect(confirmations).toEqual([{ borradorId: '44444444-4444-4444-8444-444444444444', revision: 1 }]);
});

test('si no hay reconocimiento de voz, el mensaje sigue disponible por texto', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
  });
  await page.goto('/asistente');
  await expect(page.getByRole('button', { name: 'Iniciar dictado' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Tu mensaje' }).fill('Mi agenda de hoy');
  await expect(page.getByRole('button', { name: 'Enviar mensaje' })).toBeEnabled();
});

test('un rechazo del acceso sigue visible después de desaparecer el aviso temporal', async ({ page, context }) => {
  await context.clearCookies();
  await page.route('**/api/auth/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: path.endsWith('/login') ? 'Credenciales inválidas' : 'No autorizado' }) });
  });
  await page.goto('/login');
  await page.getByLabel('Correo electrónico', { exact: true }).fill('cuenta@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('invalid-test-password');
  await page.getByRole('button', { name: 'Entrar al sistema' }).click();
  const error = page.locator('#login-error');
  await expect(error).toContainText('Credenciales inválidas');
  await expect(error.getByRole('link', { name: 'Recuperar acceso' })).toHaveAttribute('href', '/olvide-contrasena');
  await page.clock.install();
  await page.clock.fastForward(8000);
  await expect(error).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar al sistema' })).toBeEnabled();
});
