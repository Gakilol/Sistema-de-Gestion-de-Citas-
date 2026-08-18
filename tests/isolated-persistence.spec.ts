import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

const prisma = new PrismaClient();
const createdClientIds = new Set<string>();
const createdAppointmentIds = new Set<string>();

async function authenticateAsAdmin(page: Page) {
  const admin = await prisma.empleado.findFirst({
    where: { rol: 'ADMIN', activo: true },
    select: { id: true, correo: true, rol: true },
  });
  if (!admin) throw new Error('El seed E2E no creó un administrador activo.');

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET no está configurado para la suite E2E.');

  const token = await new SignJWT({ id: admin.id, email: admin.correo, rol: admin.rol })
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

test.describe('Persistencia en base E2E aislada', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateAsAdmin(page);
  });

  test.afterAll(async () => {
    const ids = [...createdClientIds];
    if (ids.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
      await prisma.cita.deleteMany({ where: { id: { in: [...createdAppointmentIds] } } });
      await prisma.cliente.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
  });

  test('registra un cliente desde la UI y confirma el guardado real', async ({ page }) => {
    const runId = process.env.TEST_RUN_ID || `e2e-${Date.now()}`;
    const clientName = `Cliente E2E ${runId}`;

    await page.goto('/clientes');
    await page.getByRole('button', { name: /Registrar cliente|Registrar/i }).click();

    const dialog = page.getByRole('dialog', { name: /Agregar Cliente/i });
    await dialog.getByPlaceholder(/Juan Pérez/i).fill(clientName);

    const createResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/clientes' &&
        response.request().method() === 'POST'
    );
    await dialog.getByRole('button', { name: 'Registrar Cliente' }).click();

    const response = await createResponsePromise;
    expect(response.status()).toBe(201);
    const payload = await response.json();
    createdClientIds.add(payload.cliente.id);

    await expect(dialog).toBeHidden();
    await page.getByRole('textbox', { name: 'Buscar clientes' }).fill(clientName);
    await expect(page.getByText(clientName, { exact: true }).first()).toBeVisible();

    const persisted = await prisma.cliente.findUnique({
      where: { id: payload.cliente.id },
      select: { nombre: true },
    });
    expect(persisted?.nombre).toBe(clientName);
  });

  test('abre WhatsApp y registra un recordatorio de cliente inactivo', async ({ page }) => {
    const runId = process.env.TEST_RUN_ID || `e2e-${Date.now()}`;
    const admin = await prisma.empleado.findFirstOrThrow({
      where: { rol: 'ADMIN', activo: true },
      select: { id: true },
    });
    const service = await prisma.servicio.findFirstOrThrow({
      where: { activo: true },
      select: { id: true },
    });
    const client = await prisma.cliente.create({
      data: {
        nombre: `Cliente Inactivo ${runId}`,
        telefono: '50685831295',
        createdByUserId: admin.id,
      },
    });
    createdClientIds.add(client.id);

    const appointment = await prisma.cita.create({
      data: {
        cliente_id: client.id,
        cliente_nombre: client.nombre,
        cliente_telefono: client.telefono,
        servicio_id: service.id,
        empleado_id: admin.id,
        fecha: new Date('2025-01-15T00:00:00.000Z'),
        hora: '10:00',
        duracion: 30,
        estado: 'COMPLETADA',
        completed_at: new Date('2025-01-15T10:30:00.000Z'),
        created_by: admin.id,
      },
    });
    createdAppointmentIds.add(appointment.id);

    await page.goto('/clientes-inactivos');
    const row = page.getByRole('row').filter({ hasText: client.nombre });
    await expect(row.getByText(client.nombre, { exact: true })).toBeVisible();

    const reminderResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/gestion/clientes-inactivos/recordatorio' &&
        response.request().method() === 'POST'
    );
    const popupPromise = page.waitForEvent('popup');
    await row.getByRole('button', { name: 'Recordatorio' }).click();

    const [response, popup] = await Promise.all([reminderResponse, popupPromise]);
    expect(response.status()).toBe(201);
    await expect.poll(() => popup.url()).toMatch(/wa\.me|whatsapp\.com/);

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: client.id,
        module: 'CLIENTES_INACTIVOS',
        action: 'REMINDER_SENT',
        status: 'SUCCESS',
      },
    });
    expect(audit).not.toBeNull();
    await expect(row.getByText('Enviado')).toBeVisible();
    await popup.close();
  });
});
