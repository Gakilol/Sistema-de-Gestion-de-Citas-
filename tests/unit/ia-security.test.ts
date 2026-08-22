import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkToolPermission } from '@/lib/ia/permissions';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('asistente Hair Style', () => {
  it('solo expone herramientas conocidas a los tres roles', () => {
    for (const role of ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'] as const) {
      expect(checkToolPermission('getTodayAppointments', role)).toBe(true);
      expect(checkToolPermission('prepareCreateAppointment', role)).toBe(true);
      expect(checkToolPermission('prepareCreateClient', role)).toBe(true);
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
    const builders = read('lib/ia/action-builders.ts');
    expect(tools).toContain('getScopedAppointmentWhere');
    expect(tools).not.toMatch(/\.create\(|\.update\(|\.delete\(/);
    expect(builders).not.toMatch(/\.create\(|\.update\(|\.delete\(/);
    expect(builders).toContain("endpoint: '/api/citas'");
    expect(builders).toContain("endpoint: '/api/clientes'");
  });

  it('requiere confirmación humana y reutiliza las APIs protegidas para guardar', () => {
    const page = read('app/ia/page.tsx');
    const route = read('app/api/ia/chat/route.ts');
    expect(route).toContain('pendingAction');
    expect(route).toContain('IA_TOOL_PREPARE');
    expect(page).toContain('Ningún cambio se guarda sin tu confirmación');
    expect(page).toContain('authFetch(action.endpoint');
    expect(page).toContain('action.confirmLabel');
  });
});
