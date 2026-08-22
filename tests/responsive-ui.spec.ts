import { expect, test, type Page } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { getBusinessTodayString } from '../lib/timezone';

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

function assertNonProductionTestEnvironment() {
  const productionSignals = [
    process.env.NODE_ENV,
    process.env.APP_ENV,
    process.env.VERCEL_ENV,
  ];

  if (productionSignals.some((value) => value?.toLowerCase() === 'production')) {
    throw new Error('Las pruebas E2E autenticadas no pueden ejecutarse contra producción.');
  }
}

async function authenticate(page: Page, rol: 'ADMIN' | 'EMPLEADO' | 'TECH_SUPPORT' = 'ADMIN') {
  assertNonProductionTestEnvironment();

  const empleado = await prisma.empleado.findFirst({
    where: { rol, activo: true },
    select: { id: true, correo: true, rol: true },
  });

  if (!empleado) {
    throw new Error(`No existe un usuario activo con rol ${rol} para la prueba.`);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET no está configurado para firmar la sesión de prueba.');
  }

  const token = await new SignJWT({
    id: empleado.id,
    email: empleado.correo,
    rol: empleado.rol,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(jwtSecret));

  await page.context().addCookies([
    {
      name: 'access_token',
      value: token,
      url: test.info().project.use.baseURL as string,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

async function expectNoDocumentOverflow(page: Page) {
  await expect
    .poll(async () =>
      page.locator('html').evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }))
    )
    .toEqual(
      expect.objectContaining({
        clientWidth: expect.any(Number),
        scrollWidth: expect.any(Number),
      })
    );

  const widths = await page.locator('html').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));

  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1);
}

test.describe('UI responsive autenticada', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test('la navegación y los módulos principales caben en el viewport', async ({ page }, testInfo) => {
    test.setTimeout(120_000);

    const modules = [
      { path: '/dashboard', heading: /Hola/i },
      { path: '/ia', heading: /Qué necesitas hacer/i },
      { path: '/citas', heading: 'Agenda y citas' },
      { path: '/clientes', heading: 'Clientes' },
      { path: '/servicios', heading: /Catálogo de Servicios/i },
      { path: '/categorias', heading: /Categorías de Servicios/i },
      { path: '/empleados', heading: /Gestión de Personal/i },
      {
        path: '/configuracion',
        heading: /Configuración|Horarios de Apertura|Apariencia del Sistema|Sesiones y Dispositivos/i,
      },
      { path: '/reportes', heading: /Reportes y Analítica/i },
      { path: '/auditoria', heading: /Auditoría del Sistema/i },
      { path: '/clientes-inactivos', heading: /Clientes Inactivos/i },
    ];

    for (const module of modules) {
      await page.goto(module.path);
      await expect(page.getByRole('heading', { level: 1, name: module.heading })).toBeVisible();
      await expectNoDocumentOverflow(page);
    }

    const width = testInfo.project.use.viewport?.width ?? 1280;
    if (width < 768) {
      await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
    } else {
      await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeHidden();
    }

    if (width < 1024) {
      await expect(page.getByRole('button', { name: /Abrir menú de navegación/i })).toBeVisible();
    } else {
      await expect(page.locator('aside')).toBeVisible();
    }
  });

  test('los flujos de cita y cliente abren y cierran sus diálogos', async ({ page }) => {
    const datosAgendaListos = Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/servicios') && response.request().method() === 'GET'
      ),
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/empleados?schedulable=true') &&
          response.request().method() === 'GET'
      ),
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/citas' &&
          response.request().method() === 'GET'
      ),
      page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname === '/api/clientes' &&
          !url.searchParams.has('q') &&
          response.request().method() === 'GET'
        );
      }),
    ]);

    await page.goto('/citas');
    const [serviciosResponse, empleadosResponse, citasResponse, clientesAgendaResponse] = await datosAgendaListos;
    const [{ servicios = [] }, { empleados = [] }, { citas = [] }, { clientes: clientesAgenda = [] }] = await Promise.all([
      serviciosResponse.json(),
      empleadosResponse.json(),
      citasResponse.json(),
      clientesAgendaResponse.json(),
    ]);

    const nuevaCitaButton = page.getByRole('button', { name: /Nueva cita|Nueva/i }).first();
    await expect(nuevaCitaButton).toBeEnabled();
    await nuevaCitaButton.click();

    if (servicios.some((servicio: { activo?: boolean }) => servicio.activo) && empleados.length > 0) {
      const citaDialog = page.getByRole('dialog', { name: /Nueva cita/i });
      await expect(citaDialog).toBeVisible();
      await expect(citaDialog.getByText(/Cliente, servicios y horario/i)).toBeVisible();

      const clienteSearch = citaDialog.getByPlaceholder(/Buscar por nombre, teléfono o correo/i);
      if (clientesAgenda.length > 0) {
        const clienteExistente = clientesAgenda[0];
        const consultaParcial = clienteExistente.nombre.slice(
          0,
          Math.max(2, Math.min(8, clienteExistente.nombre.length))
        );
        const busquedaRemota = page.waitForResponse((response) => {
          const url = new URL(response.url());
          return url.pathname === '/api/clientes' && url.searchParams.get('q') === consultaParcial;
        });

        await clienteSearch.fill(consultaParcial);
        const respuestaBusqueda = await busquedaRemota;
        expect(respuestaBusqueda.ok()).toBeTruthy();
        await expect(citaDialog.getByText(clienteExistente.nombre, { exact: true })).toBeVisible();
      }

      await clienteSearch.fill('Cliente de prueba UI');
      await expect(citaDialog.getByRole('button', { name: /\+ Nuevo Cliente/i })).toBeVisible();
      await expect(citaDialog.getByRole('button', { name: /Crear solo con nombre/i })).toBeEnabled();

      await citaDialog.getByRole('button', { name: 'Cerrar modal' }).click();
      await expect(citaDialog).toBeHidden();
    } else {
      await expect(
        page.getByText(/Crea al menos un servicio y un empleado activos primero/i)
      ).toBeVisible();
    }

    await page.getByRole('main').getByRole('button', { name: 'Agenda', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Hoy', exact: true })).toBeVisible();
    await expectNoDocumentOverflow(page);

    const citaExistente = citas.find((cita: { estado?: string }) => cita.estado !== 'CANCELADA') ?? citas[0];
    if (citaExistente) {
      const targetDate = String(citaExistente.fecha).slice(0, 10);
      const initialDate = getBusinessTodayString();
      const dayDifference = Math.round(
        (Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${initialDate}T00:00:00Z`)) /
          86_400_000
      );
      const navigationButton = page.getByRole('button', {
        name: dayDifference < 0 ? 'Fecha anterior' : 'Fecha siguiente',
      });

      for (let day = 0; day < Math.abs(dayDifference); day += 1) {
        await navigationButton.click();
      }

      const calendarBooking = page.locator('.booking-card').first();
      await expect(calendarBooking).toBeVisible();
      await calendarBooking.click();
      await expect(page.getByText('Detalle de la Cita', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Editar cita', exact: true }).click();

      const editDialog = page.getByRole('dialog', { name: /Editar cita/i });
      await expect(editDialog).toBeVisible();
      await editDialog.getByRole('button', { name: 'Cerrar modal' }).click();
      await expect(editDialog).toBeHidden();
    }

    const clientesListos = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/clientes' &&
        response.request().method() === 'GET'
    );
    await page.goto('/clientes');
    const clientesResponse = await clientesListos;
    const { clientes = [] } = await clientesResponse.json();

    if (clientes.length > 0) {
      const clienteSearch = page.getByRole('textbox', { name: 'Buscar clientes' });
      await clienteSearch.fill(clientes[0].nombre);
      await expect(
        page.getByRole('button', { name: `Ver historial de ${clientes[0].nombre}` }).first()
      ).toBeVisible();
      await clienteSearch.fill('cliente-inexistente-e2e-9f7f');
      await expect(page.getByText(/Sin resultados para/i)).toBeVisible();
      await clienteSearch.fill('');
    }

    await page.getByRole('button', { name: /Registrar cliente|Registrar/i }).click();

    const clienteDialog = page.getByRole('dialog', { name: /Agregar Cliente/i });
    await expect(clienteDialog).toBeVisible();
    await expect(clienteDialog.getByPlaceholder(/Juan Pérez/i)).toBeVisible();
    await clienteDialog.getByRole('button', { name: 'Cerrar formulario' }).click();
    await expect(clienteDialog).toBeHidden();
    await expectNoDocumentOverflow(page);
  });

  test('la navegación respeta los tres roles disponibles', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop 1440', 'La matriz de roles se valida una vez en escritorio.');

    await authenticate(page, 'EMPLEADO');
    await page.goto('/dashboard');
    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: 'Agenda', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Clientes', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Servicios', exact: true })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: 'Reportes', exact: true })).toHaveCount(0);

    await authenticate(page, 'TECH_SUPPORT');
    await page.goto('/dashboard');
    await expect(sidebar.getByRole('link', { name: 'Reportes', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Auditoría', exact: true })).toBeVisible();

    await authenticate(page, 'ADMIN');
    await page.goto('/dashboard');
    await expect(sidebar.getByRole('link', { name: 'Personal', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Configuración', exact: true })).toBeVisible();
  });
});
