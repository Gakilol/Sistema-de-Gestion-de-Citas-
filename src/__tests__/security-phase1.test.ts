import { buildClientResponse } from '../../lib/client-privacy';
import {
  getCronSecret,
  getJwtRefreshSecret,
  getJwtSecret,
  isAuthorizedCronRequest,
} from '../../lib/security-secrets';

type TestCase = { description: string; run: () => void };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const employeeId = '11111111-1111-1111-1111-111111111111';
const otherEmployeeId = '22222222-2222-2222-2222-222222222222';
const rawClient = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  nombre: 'Cliente de prueba',
  telefono: '50588887777',
  correo: 'cliente@example.test',
  notas: 'Nota privada del cliente',
  createdByUserId: employeeId,
  citas: [
    { id: 'own', empleado_id: employeeId, estado: 'COMPLETADA', servicio: { nombre: 'Corte' }, empleado: { nombre: 'Propio' } },
    { id: 'other', empleado_id: otherEmployeeId, estado: 'PENDIENTE', servicio: { nombre: 'Barba' }, empleado: { nombre: 'Ajeno' } },
  ],
  totalCitas: 2,
  citasCompletadas: 1,
  ultimaCita: new Date('2026-07-20T00:00:00Z'),
  primeraCita: new Date('2026-07-01T00:00:00Z'),
  esRecurrente: true,
  servicioFavorito: 'Corte',
  historial: [],
};

const employeeScopedClient = {
  ...rawClient,
  citas: rawClient.citas.filter((cita) => cita.empleado_id === employeeId),
  totalCitas: 1,
  citasCompletadas: 1,
  historial: rawClient.citas.filter((cita) => cita.empleado_id === employeeId),
};

const tests: TestCase[] = [
  {
    description: 'producción sin JWT_SECRET no obtiene secreto de autenticación',
    run: () => assert(getJwtSecret({ NODE_ENV: 'production' }) === null, 'JWT_SECRET ausente no fue rechazado'),
  },
  {
    description: 'no existe fallback JWT ni refresh predecible',
    run: () => {
      assert(getJwtSecret({}) === null, 'JWT_SECRET tiene fallback');
      assert(getJwtRefreshSecret({}) === null, 'JWT_REFRESH_SECRET tiene fallback');
    },
  },
  {
    description: 'cron sin CRON_SECRET queda no autorizado antes de ejecutar lógica',
    run: () => {
      assert(getCronSecret({}) === null, 'CRON_SECRET faltante fue aceptado');
      assert(!isAuthorizedCronRequest(null, {}), 'cron anónimo fue autorizado');
    },
  },
  {
    description: 'cron con token incorrecto queda no autorizado',
    run: () => assert(!isAuthorizedCronRequest('Bearer incorrecto', { CRON_SECRET: 'secreto-de-prueba' }), 'token incorrecto fue autorizado'),
  },
  {
    description: 'cron con token correcto llega a la lógica protegida',
    run: () => assert(isAuthorizedCronRequest('Bearer secreto-de-prueba', { CRON_SECRET: 'secreto-de-prueba' }), 'token correcto fue rechazado'),
  },
  {
    description: 'ADMIN conserva cliente y citas completas',
    run: () => {
      const result = buildClientResponse(rawClient, 'ADMIN');
      const citas = result.citas ?? [];
      assert(citas.length === 2 && citas.some((c) => c.id === 'other'), 'ADMIN perdió acceso completo');
    },
  },
  {
    description: 'TECH_SUPPORT conserva cliente y citas completas',
    run: () => {
      const result = buildClientResponse(rawClient, 'TECH_SUPPORT');
      assert((result.citas ?? []).length === 2 && result.telefono === rawClient.telefono, 'TECH_SUPPORT perdió acceso completo');
    },
  },
  {
    description: 'EMPLOYEE recibe el DTO permitido para un cliente accesible',
    run: () => {
      const result = buildClientResponse(employeeScopedClient, 'EMPLEADO');
      assert(result.id === rawClient.id && result.nombre === rawClient.nombre, 'DTO de EMPLEADO perdió selección básica');
      assert(result.telefono === rawClient.telefono, 'DTO de EMPLEADO perdió contacto necesario para su cliente');
      assert(!('createdByUserId' in result), 'DTO de EMPLEADO expuso metadata de propiedad');
    },
  },
  {
    description: 'EMPLOYEE no recibe citas de otros profesionales',
    run: () => {
      const result = buildClientResponse(employeeScopedClient, 'EMPLEADO');
      assert((result.citas ?? []).every((c) => c.empleado_id === employeeId), 'DTO de EMPLEADO expuso una cita ajena');
      assert((result.historial ?? []).every((c) => c.empleado_id === employeeId), 'historial de EMPLEADO expuso una cita ajena');
    },
  },
  {
    description: 'DTO EMPLEADO conserva datos para buscar y seleccionar al cliente',
    run: () => {
      const result = buildClientResponse(employeeScopedClient, 'EMPLEADO');
      assert(typeof result.nombre === 'string' && typeof result.telefono === 'string', 'búsqueda o selección de cliente se rompió');
    },
  },
];

let failed = 0;
for (const test of tests) {
  try {
    test.run();
    console.log(`OK - ${test.description}`);
  } catch (error) {
    failed++;
    console.error(`FAIL - ${test.description}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed > 0) process.exit(1);
console.log(`${tests.length} pruebas de seguridad superadas.`);
