import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAuditAuth } from '@/lib/audit/audit-auth';

export async function GET(req: NextRequest) {
  const auth = checkAuditAuth(req);
  if ('error' in auth) return auth.error;

  try {
    const securityActions = [
      'LOGIN_FAILED',
      'UNAUTHORIZED_ACCESS_ATTEMPT',
      'FORBIDDEN_API_ACCESS',
      'INVALID_TOKEN_ATTEMPT',
      'RATE_LIMIT_EXCEEDED',
      'SESSION_REVOKED',
      'PASSWORD_RESET_REQUESTED',
      'PASSWORD_CHANGED'
    ];

    const [
      loginFailedCount,
      unauthorizedAccessCount,
      forbiddenApiCount,
      rateLimitCount,
      passwordResetCount,
      passwordChangedCount,
      recentSecurityEvents
    ] = await Promise.all([
      prisma.auditLog.count({ where: { action: 'LOGIN_FAILED' } }),
      prisma.auditLog.count({ where: { action: 'UNAUTHORIZED_ACCESS_ATTEMPT' } }),
      prisma.auditLog.count({ where: { action: 'FORBIDDEN_API_ACCESS' } }),
      prisma.auditLog.count({ where: { action: 'RATE_LIMIT_EXCEEDED' } }),
      prisma.auditLog.count({ where: { action: 'PASSWORD_RESET_REQUESTED' } }),
      prisma.auditLog.count({ where: { action: 'PASSWORD_CHANGED' } }),
      prisma.auditLog.findMany({
        where: { action: { in: securityActions } },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          createdAt: true,
          action: true,
          module: true,
          description: true,
          userName: true,
          userEmail: true,
          ipAddress: true,
          status: true
        }
      })
    ]);

    // Check for suspicious activities (e.g. multiple login failures from same IP or email in a short window)
    // We group login failures by IP in the last 24 hours to find hotspots
    const suspiciousIpsRaw: any[] = await prisma.$queryRaw`
      SELECT "ipAddress", COUNT(*) as count
      FROM "AuditLog"
      WHERE "action" = 'LOGIN_FAILED'
        AND "createdAt" >= NOW() - INTERVAL '24 HOURS'
        AND "ipAddress" IS NOT NULL
      GROUP BY "ipAddress"
      HAVING COUNT(*) >= 5
      ORDER BY count DESC
      LIMIT 5
    `;

    const suspiciousIps = suspiciousIpsRaw.map(row => ({
      ipAddress: row.ipAddress,
      count: Number(row.count)
    }));

    return NextResponse.json({
      stats: {
        loginFailedCount,
        unauthorizedAccessCount,
        forbiddenApiCount,
        rateLimitCount,
        passwordResetCount,
        passwordChangedCount
      },
      recentEvents: recentSecurityEvents,
      suspiciousIps
    });
  } catch (err: any) {
    console.error('[/api/auditoria/seguridad]', err);
    return NextResponse.json({ error: 'Error al generar auditoría de seguridad.' }, { status: 500 });
  }
}
