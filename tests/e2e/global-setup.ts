import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  assertNonProductionE2ERuntime,
  assertSafeE2EDatabaseUrl,
} from './database-safety';

function runPrisma(args: string[]) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, ['prisma', ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(`Falló "prisma ${args.join(' ')}" para la base E2E.`);
  }
}

async function seedResponsiveTestData() {
  const prisma = new PrismaClient();

  try {
    const passwordHash = await bcrypt.hash('E2E-Only-Password-123!', 10);
    const users = [
      {
        correo: 'empleado.e2e@sistema.test',
        nombre: 'Empleado E2E',
        rol: 'EMPLEADO' as const,
        esAgendable: true,
      },
      {
        correo: 'soporte.e2e@sistema.test',
        nombre: 'Soporte E2E',
        rol: 'TECH_SUPPORT' as const,
        esAgendable: false,
      },
    ];

    for (const user of users) {
      await prisma.empleado.upsert({
        where: { correo: user.correo },
        update: {
          activo: true,
          esAgendable: user.esAgendable,
          nombre: user.nombre,
          rol: user.rol,
        },
        create: {
          ...user,
          activo: true,
          passwordHash,
        },
      });
    }

    const category = await prisma.categoria.upsert({
      where: { nombre: 'Servicios E2E' },
      update: { activo: true },
      create: {
        nombre: 'Servicios E2E',
        color: '#6366f1',
        activo: true,
      },
    });

    const existingService = await prisma.servicio.findFirst({
      where: { nombre: 'Corte E2E' },
      select: { id: true },
    });

    if (existingService) {
      await prisma.servicio.update({
        where: { id: existingService.id },
        data: { activo: true, categoria: category.nombre, categoria_id: category.id },
      });
    } else {
      await prisma.servicio.create({
        data: {
          nombre: 'Corte E2E',
          descripcion: 'Servicio exclusivo para pruebas responsive.',
          duracion: 30,
          categoria: category.nombre,
          categoria_id: category.id,
          activo: true,
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

export default async function globalSetup() {
  assertNonProductionE2ERuntime();
  const identity = assertSafeE2EDatabaseUrl(
    process.env.E2E_DATABASE_URL,
    process.env.APPLICATION_DATABASE_URL
  );

  if (process.env.DATABASE_URL !== process.env.E2E_DATABASE_URL) {
    throw new Error('DATABASE_URL no fue reemplazada por la conexión E2E validada.');
  }

  console.log(`Preparando base E2E aislada: ${identity.host}/${identity.database}`);
  runPrisma(['migrate', 'deploy']);
  runPrisma(['db', 'seed']);
  await seedResponsiveTestData();
}
