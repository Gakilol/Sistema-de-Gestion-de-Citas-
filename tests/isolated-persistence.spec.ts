import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

const prisma = new PrismaClient();
const createdClientIds = new Set<string>();

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
});
