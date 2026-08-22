import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkToolPermission } from '@/lib/ia/permissions';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('asistente Hair Style', () => {
  it('solo expone herramientas de lectura conocidas a los tres roles', () => {
    for (const role of ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'] as const) {
      expect(checkToolPermission('getTodayAppointments', role)).toBe(true);
      expect(checkToolPermission('deleteAppointment', role)).toBe(false);
    }
  });

  it('mantiene Prisma fuera de la ruta del modelo y aplica permisos en backend', () => {
    const route = read('app/api/ia/chat/route.ts');
    expect(route).not.toContain("from '@/lib/db'");
    expect(route).toContain('checkToolPermission');
    expect(route).toContain('executeIATool');
  });

  it('aplica el alcance de citas del usuario dentro de las herramientas', () => {
    const tools = read('lib/ia/tools.ts');
    expect(tools).toContain('getScopedAppointmentWhere');
    expect(tools).not.toMatch(/\.create\(|\.update\(|\.delete\(/);
  });
});
