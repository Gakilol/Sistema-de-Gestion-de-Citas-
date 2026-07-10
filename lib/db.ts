import { PrismaClient } from '@prisma/client';
import { assertCanWriteToDatabase } from '../src/lib/env-guard';

const globalForPrisma = global as unknown as { prisma: any };

const prismaRaw =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaRaw;

// Extender Prisma Client para interceptar y bloquear escrituras bajo condiciones inseguras,
// así como etiquetar de manera automática los registros creados con TEST_RUN_ID en entornos de QA.
export const prisma = prismaRaw.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: any) {
        const writeOperations = [
          'create',
          'createMany',
          'update',
          'updateMany',
          'upsert',
          'delete',
          'deleteMany',
        ];

        // Validar permisos de escritura en la base de datos
        if (writeOperations.includes(operation)) {
          assertCanWriteToDatabase();
        }

        // Auto-etiquetado con TEST_RUN_ID si existe en las variables de entorno
        const testRunId = process.env.TEST_RUN_ID;
        if (testRunId && operation === 'create') {
          const tag = `[${testRunId}]`;
          const dataArgs = (args as any).data;
          
          if (dataArgs) {
            if (model === 'Cita') {
              dataArgs.notas = dataArgs.notas ? `${dataArgs.notas} ${tag}` : tag;
            } else if (model === 'Cliente') {
              dataArgs.notas = dataArgs.notas ? `${dataArgs.notas} ${tag}` : tag;
            } else if (model === 'Servicio') {
              dataArgs.descripcion = dataArgs.descripcion ? `${dataArgs.descripcion} ${tag}` : tag;
            }
          }
        }

        return query(args);
      },
    },
    async $executeRaw({ args, query }: any) {
      assertCanWriteToDatabase();
      return query(args);
    },
    async $executeRawUnsafe({ args, query }: any) {
      assertCanWriteToDatabase();
      return query(args);
    },
  },
});

