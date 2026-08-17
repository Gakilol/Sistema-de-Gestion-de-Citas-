'use client';

let sessionRenewal: Promise<boolean> | null = null;

async function renewSession(): Promise<boolean> {
  try {
    const refreshResponse = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    });

    if (refreshResponse.ok) return true;

    const autoLoginResponse = await fetch('/api/auth/auto-login', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    });

    return autoLoginResponse.ok;
  } catch {
    return false;
  }
}

function isSessionRenewalRequest(input: RequestInfo | URL): boolean {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  return (
    url.includes('/api/auth/refresh') ||
    url.includes('/api/auth/auto-login') ||
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/logout')
  );
}

/**
 * Ejecuta solicitudes autenticadas y recupera una sesión vencida una sola vez.
 * Las solicitudes simultáneas comparten la misma renovación para evitar carreras.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const requestInit: RequestInit = {
    ...init,
    credentials: init.credentials ?? 'same-origin',
  };

  const response = await fetch(input, requestInit);

  if (response.status !== 401 || isSessionRenewalRequest(input)) {
    return response;
  }

  if (!sessionRenewal) {
    sessionRenewal = renewSession().finally(() => {
      sessionRenewal = null;
    });
  }

  const renewed = await sessionRenewal;
  if (!renewed) return response;

  return fetch(input, requestInit);
}
