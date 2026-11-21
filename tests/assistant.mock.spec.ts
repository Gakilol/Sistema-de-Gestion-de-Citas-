import { expect, test } from '@playwright/test';
import { SignJWT } from 'jose';

const employee = { id: '22222222-2222-4222-8222-222222222222', nombre: 'Carlos Méndez' };
const clientA = { id: '11111111-1111-4111-8111-111111111111', nombre: 'Ana López', pista: 'tel. ···1111' };
const clientB = { id: '11111111-1111-4111-8111-111111111112', nombre: 'Ana López', pista: 'tel. ···2222' };
const service = { id: '33333333-3333-4333-8333-333333333333', nombre: 'Corte', duracion: 30 };
const draftId = '44444444-4444-4444-8444-444444444444';

async function authenticatePage(page: import('@playwright/test').Page, baseURL: string, rol: 'ADMIN' | 'EMPLEADO' = 'ADMIN') {
  const token = await new SignJWT({ id: employee.id, email: 'assistant@test.local', rol })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode('assistant-browser-test-only-secret-32-characters'));
  await page.context().addCookies([
    { name: 'access_token', value: token, url: baseURL, httpOnly: true, sameSite: 'Lax' },
  ]);
}

test.beforeEach(async ({ page, baseURL }) => {
  await authenticatePage(page, baseURL!);
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
    const spokenLog: string[] = [];
    let lastProcessLocally: boolean | undefined;
    (window as unknown as { __spokenLog: string[]; __lastProcessLocally?: boolean; __dictationScript?: string }).__spokenLog = spokenLog;

    class MockRecognition {
      lang = '';
      interimResults = false;
      continuous = false;
      processLocally?: boolean;
      onresult: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror = null;
      static async available() {
        return 'available';
      }
      start() {
        lastProcessLocally = this.processLocally;
        (window as unknown as { __lastProcessLocally?: boolean }).__lastProcessLocally = lastProcessLocally;
        const text =
          (window as unknown as { __dictationScript?: string }).__dictationScript
          || 'Agenda a Ana Lopes para corte el viernes por la tarde';
        setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: text } }] });
          this.onend?.();
        }, 25);
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }

    class MockUtterance {
      text: string;
      voice: SpeechSynthesisVoice | null = null;
      lang = '';
      rate = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }

    Object.defineProperty(window, 'SpeechRecognition', { value: MockRecognition, configurable: true });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: MockUtterance, configurable: true });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [{ name: 'Voz Local CR', lang: 'es-CR', localService: true }],
        addEventListener: () => {},
        removeEventListener: () => {},
        cancel: () => {},
        speak: (utterance: { text: string; onstart?: () => void; onend?: () => void }) => {
          spokenLog.push(utterance.text);
          utterance.onstart?.();
          setTimeout(() => utterance.onend?.(), 10);
        },
      },
    });
  });
});

test('conversación completa por voz y texto sin tabla, con corrección de transcripción, «sí, confirma» y confirmación en pantalla', async ({ page }, testInfo) => {
  const confirmations: object[] = [];
  const chatMessages: string[] = [];

  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ usuario: { ...employee, rol: 'ADMIN', email: 'assistant@test.local' } }),
      });
    }
    if (path === '/api/ia/contexto') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ servicios: [service], empleados: [employee], baseCompartida: true }),
      });
    }
    if (path === '/api/ia/chat') {
      const body = route.request().postDataJSON() as { mensaje: string; revision?: number };
      chatMessages.push(body.mensaje);
      const msg = body.mensaje.toLowerCase();
      const baseDraft = {
        id: draftId,
        operacion: 'crear',
        clienteId: clientA.id,
        clienteNombre: clientA.nombre,
        empleadoId: employee.id,
        profesionalNombre: employee.nombre,
        servicios: [service],
        expiresAt: new Date(Date.now() + 900000).toISOString(),
      };

      if (msg.includes('ana lópez') && msg.includes('viernes')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            text: 'Tengo estos horarios disponibles para Ana López para Corte el viernes 20 de noviembre por la tarde:',
            spokenText: 'Para Ana López, el viernes 20 de noviembre por la tarde tengo tres horarios. ¿Cuál prefieres?',
            mode: 'gemini',
            horariosOfrecidos: [
              { fecha: '2026-11-20', hora: '14:00', empleadoId: employee.id, empleadoNombre: employee.nombre },
              { fecha: '2026-11-20', hora: '15:00', empleadoId: employee.id, empleadoNombre: employee.nombre },
              { fecha: '2026-11-20', hora: '16:00', empleadoId: employee.id, empleadoNombre: employee.nombre },
            ],
            draft: { ...baseDraft, revision: 1, fecha: '2026-11-20', hora: null, listo: false, faltantes: ['Indica o elige la hora.'] },
          }),
        });
      }

      if (msg === 'la segunda') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            text: 'Listo, preparé la cita: Ana López · Corte el viernes 20 de noviembre a las 3:00 PM con Carlos Méndez.',
            spokenText: 'Preparé la cita para las 3 de la tarde. Revisa el resumen y pulsa Confirmar cita.',
            mode: 'local',
            draft: { ...baseDraft, revision: 2, fecha: '2026-11-20', hora: '15:00', listo: true, faltantes: [] },
          }),
        });
      }

      if (msg.includes('cuatro')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            text: 'Listo, cambié la hora a las 4:00 PM el viernes 20 de noviembre para Ana López.',
            spokenText: 'Cambié la hora a las 4 de la tarde.',
            mode: 'gemini',
            draft: { ...baseDraft, revision: 3, fecha: '2026-11-20', hora: '16:00', listo: true, faltantes: [] },
          }),
        });
      }

      if (msg.includes('sábado')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            text: 'Para el sábado 21 de noviembre tengo estos horarios disponibles para Ana López:',
            spokenText: 'El sábado 21 de noviembre tengo opciones a las 9 y 10 de la mañana.',
            mode: 'gemini',
            horariosOfrecidos: [
              { fecha: '2026-11-21', hora: '09:00', empleadoId: employee.id, empleadoNombre: employee.nombre },
              { fecha: '2026-11-21', hora: '10:00', empleadoId: employee.id, empleadoNombre: employee.nombre },
            ],
            draft: { ...baseDraft, revision: 4, fecha: '2026-11-21', hora: null, listo: false, faltantes: ['Indica o elige la hora.'] },
          }),
        });
      }

      if (msg === 'la primera') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            text: 'Listo, preparé la cita: Ana López · Corte el sábado 21 de noviembre a las 9:00 AM con Carlos Méndez.',
            spokenText: 'Preparé la cita para el sábado a las 9 de la mañana.',
            mode: 'local',
            draft: { ...baseDraft, revision: 5, fecha: '2026-11-21', hora: '09:00', listo: true, faltantes: [] },
          }),
        });
      }

      if (msg.includes('confirma')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            text: 'Aquí tienes el resumen pendiente listo para confirmar. Por seguridad, pulsa «Confirmar cita» en pantalla.',
            spokenText: 'El resumen está en pantalla. Por seguridad, pulsa el botón Confirmar cita.',
            mode: 'local',
            highlightConfirmation: true,
            draft: { ...baseDraft, revision: 5, fecha: '2026-11-21', hora: '09:00', listo: true, faltantes: [], confirmacionSolicitada: true },
          }),
        });
      }

      throw new Error(`Unexpected chat turn: ${body.mensaje}`);
    }
    if (path === '/api/ia/citas/confirmar') {
      confirmations.push(route.request().postDataJSON());
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ citaId: 'cita-creada', operacion: 'crear', mensaje: 'Cita registrada correctamente.' }),
      });
    }
    throw new Error(`Unexpected API request: ${path}`);
  });

  await page.goto('/asistente');
  await expect(page.getByRole('heading', { name: 'Asistente NovaCita' })).toBeVisible();
  await expect(page.getByText('Voz local en el dispositivo')).toBeVisible();

  // 1. Dictado con error de transcripción ("Ana Lopes") -> se corrige manualmente a "Ana López" antes de enviar
  await page.getByRole('button', { name: 'Iniciar dictado' }).click();
  const textbox = page.getByRole('textbox', { name: 'Tu mensaje' });
  await expect(textbox).toHaveValue('Agenda a Ana Lopes para corte el viernes por la tarde');
  expect(await page.evaluate(() => (window as unknown as { __lastProcessLocally?: boolean }).__lastProcessLocally)).toBe(true);

  await textbox.fill('Agenda a Ana López para corte el viernes por la tarde');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();

  await expect(page.getByText('3:00 PM')).toBeVisible();
  // Respuesta hablada por voz local
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __spokenLog: string[] }).__spokenLog.length)).toBeGreaterThan(0);

  // 2. "la segunda" -> "mejor a las cuatro" -> "¿y el sábado?" -> "la primera" -> "sí, confirma"
  await textbox.fill('la segunda');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  const preview = page.getByRole('region', { name: 'Resumen de la cita' });
  await expect(preview).toContainText('3:00 PM');

  await textbox.fill('mejor a las cuatro');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(preview).toContainText('4:00 PM');

  await textbox.fill('¿y el sábado?');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByText('9:00 AM')).toBeVisible();

  await textbox.fill('la primera');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(preview).toContainText('9:00 AM');

  await textbox.fill('sí, confirma');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(preview).toContainText('Confirmación en pantalla requerida');
  expect(confirmations).toHaveLength(0);

  // Sin desbordamiento horizontal en desktop ni móvil
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/assistant-${testInfo.project.name.includes('Android') ? 'mobile' : 'desktop'}.png`,
    fullPage: true,
  });

  // 3. Confirmación efectiva únicamente al pulsar el botón en pantalla
  await page.getByRole('button', { name: 'Confirmar cita' }).click();
  await expect(page.getByRole('heading', { name: 'Cita registrada' })).toBeVisible();
  expect(confirmations).toEqual([{ borradorId: draftId, revision: 5 }]);
  expect(chatMessages[0]).toBe('Agenda a Ana López para corte el viernes por la tarde');
});

test('maneja cliente ambiguo con aclaración mínima y recupera conflicto de horario al confirmar', async ({ page }) => {
  let confirmAttempts = 0;

  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ usuario: { ...employee, rol: 'ADMIN', email: 'assistant@test.local' } }),
      });
    }
    if (path === '/api/ia/contexto') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ servicios: [service], empleados: [employee], baseCompartida: true }),
      });
    }
    if (path === '/api/ia/chat') {
      const body = route.request().postDataJSON() as { mensaje: string };
      const msg = body.mensaje.toLowerCase();
      if (msg.includes('ana lópez')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            text: 'Encontré 2 clientes similares a «Ana López». ¿Cuál es?',
            mode: 'gemini',
            clientesCandidatos: [clientA, clientB],
            draft: {
              id: draftId,
              revision: 1,
              operacion: 'crear',
              clienteId: null,
              clienteNombre: null,
              empleadoId: null,
              profesionalNombre: null,
              servicios: [service],
              fecha: '2026-11-20',
              hora: null,
              expiresAt: new Date(Date.now() + 900000).toISOString(),
              listo: false,
              faltantes: ['Indica el cliente para la cita.'],
            },
          }),
        });
      }
      if (msg === 'la segunda') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            text: 'Listo, preparé la cita para Ana López (···2222) a las 3:00 PM.',
            mode: 'local',
            draft: {
              id: draftId,
              revision: 2,
              operacion: 'crear',
              clienteId: clientB.id,
              clienteNombre: clientB.nombre,
              empleadoId: employee.id,
              profesionalNombre: employee.nombre,
              servicios: [service],
              fecha: '2026-11-20',
              hora: '15:00',
              expiresAt: new Date(Date.now() + 900000).toISOString(),
              listo: true,
              faltantes: [],
            },
          }),
        });
      }
      if (msg === 'la primera') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            text: 'Listo, actualicé la cita a las 4:00 PM.',
            mode: 'local',
            draft: {
              id: draftId,
              revision: 4,
              operacion: 'crear',
              clienteId: clientB.id,
              clienteNombre: clientB.nombre,
              empleadoId: employee.id,
              profesionalNombre: employee.nombre,
              servicios: [service],
              fecha: '2026-11-20',
              hora: '16:00',
              expiresAt: new Date(Date.now() + 900000).toISOString(),
              listo: true,
              faltantes: [],
            },
          }),
        });
      }
      throw new Error(`Unexpected message: ${body.mensaje}`);
    }
    if (path === '/api/ia/citas/confirmar') {
      confirmAttempts += 1;
      if (confirmAttempts === 1) {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'SLOT_OCCUPIED',
            error: 'El horario de las 3:00 PM se ocupó antes de confirmar. Aquí tienes nuevas opciones disponibles:',
            spokenText: 'El horario de las 3 de la tarde acaba de ocuparse. Tengo las 4 de la tarde disponible.',
            horarios: ['16:00'],
            horariosOfrecidos: [
              { fecha: '2026-11-20', hora: '16:00', empleadoId: employee.id, empleadoNombre: employee.nombre },
            ],
            draft: {
              id: draftId,
              revision: 3,
              operacion: 'crear',
              clienteId: clientB.id,
              clienteNombre: clientB.nombre,
              empleadoId: employee.id,
              profesionalNombre: employee.nombre,
              servicios: [service],
              fecha: '2026-11-20',
              hora: null,
              expiresAt: new Date(Date.now() + 900000).toISOString(),
              listo: false,
              faltantes: ['Indica o elige la hora.'],
            },
          }),
        });
      }
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ citaId: 'cita-recuperada', operacion: 'crear', mensaje: 'Cita registrada correctamente.' }),
      });
    }
    throw new Error(`Unexpected API request: ${path}`);
  });

  await page.goto('/asistente');
  const textbox = page.getByRole('textbox', { name: 'Tu mensaje' });
  await textbox.fill('Agenda a Ana López para corte el viernes a las 3 de la tarde');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();

  // Muestra clientes homónimos con pista mínima
  await expect(page.getByRole('button', { name: /tel\. ···1111/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /tel\. ···2222/ })).toBeVisible();
  await page.getByRole('button', { name: /tel\. ···2222/ }).click();

  await expect(page.getByRole('button', { name: 'Confirmar cita' })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirmar cita' }).click();

  // Conflicto al confirmar -> informa y ofrece nuevas opciones
  await expect(page.getByText(/se ocupó antes de confirmar/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /4:00 PM/ })).toBeVisible();
  await page.getByRole('button', { name: /4:00 PM/ }).click();

  await expect(page.getByRole('button', { name: 'Confirmar cita' })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirmar cita' }).click();
  await expect(page.getByRole('heading', { name: 'Cita registrada' })).toBeVisible();
});

test('sesión sin permisos muestra bloqueo claro del asistente', async ({ page }) => {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ usuario: { ...employee, rol: 'EMPLEADO', email: 'inactivo@test.local' } }),
      });
    }
    if (path === '/api/ia/contexto') {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Tu cuenta no tiene acceso al asistente.' }),
      });
    }
    throw new Error(`Unexpected API request: ${path}`);
  });

  await page.goto('/asistente');
  const alert = page.getByRole('main').getByRole('alert');
  await expect(alert).toContainText('Asistente no disponible');
  await expect(alert).toContainText('Tu cuenta no tiene acceso al asistente.');
});

test('protege privacidad cuando el navegador no confirma voz local y funciona por texto sin SpeechRecognition', async ({ page }) => {
  await page.addInitScript(() => {
    // 1. SpeechRecognition sin available() -> debe pedir consentimiento explícito antes de grabar
    class CloudOnlyRecognition {
      lang = '';
      interimResults = false;
      continuous = false;
      start() {
        (window as unknown as { __startedUnexpectedly?: boolean }).__startedUnexpectedly = true;
      }
      stop() {}
      abort() {}
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: CloudOnlyRecognition, configurable: true });
    // 2. TTS con solo voces remotas -> NO debe reproducir datos de clientes
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [{ name: 'Cloud Voice', lang: 'es-ES', localService: false }],
        addEventListener: () => {},
        removeEventListener: () => {},
        cancel: () => {},
        speak: () => {
          (window as unknown as { __remoteTtsCalled?: boolean }).__remoteTtsCalled = true;
        },
      },
    });
  });

  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ usuario: { ...employee, rol: 'ADMIN', email: 'assistant@test.local' } }),
      });
    }
    if (path === '/api/ia/contexto') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ servicios: [service], empleados: [employee], baseCompartida: true }),
      });
    }
    if (path === '/api/ia/chat') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: 'No hay citas hoy.', spokenText: 'No hay citas hoy.', mode: 'local' }),
      });
    }
    throw new Error(`Unexpected API request: ${path}`);
  });

  await page.goto('/asistente');
  await page.getByRole('button', { name: 'Iniciar dictado' }).click();
  await expect(page.getByRole('region', { name: 'Aviso de privacidad del reconocimiento de voz' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __startedUnexpectedly?: boolean }).__startedUnexpectedly)).toBeFalsy();

  await page.getByRole('button', { name: 'Seguir por texto' }).click();
  await page.getByRole('textbox', { name: 'Tu mensaje' }).fill('Mi agenda de hoy');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByText('No hay citas hoy.')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __remoteTtsCalled?: boolean }).__remoteTtsCalled)).toBeFalsy();
});

test('si no hay reconocimiento de voz, el mensaje sigue disponible por texto', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
  });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ usuario: { ...employee, rol: 'ADMIN', email: 'assistant@test.local' } }),
      });
    }
    if (path === '/api/ia/contexto') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ servicios: [service], empleados: [employee], baseCompartida: true }),
      });
    }
    throw new Error(`Unexpected API request: ${path}`);
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
    return route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: path.endsWith('/login') ? 'Credenciales inválidas' : 'No autorizado' }),
    });
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
