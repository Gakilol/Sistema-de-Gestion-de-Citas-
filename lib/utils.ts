import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const MONEDA_SIMBOLO: Record<string, string> = { USD: '$', NIO: 'C$', CRC: '₡' };

export function formatCurrency(amount: number, moneda: string = 'USD', tipoCambio: number = 1): string {
  const convertido = moneda === 'USD' ? amount : amount * tipoCambio;
  const simbolo = MONEDA_SIMBOLO[moneda] ?? '$';
  
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: moneda === 'USD' || moneda === 'NIO' || moneda === 'CRC' ? moneda : 'USD',
    currencyDisplay: 'symbol',
  })
    .format(convertido)
    .replace(/[a-zA-Z]+/, simbolo) // Replace default currency code with our symbol if needed
    .trim();
}

export function parseCurrencyCRC(value: number | string | any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : Math.round(value);
  }
  // Convert from Prisma Decimal object if applicable
  if (value && typeof value === 'object' && typeof value.toNumber === 'function') {
    return Math.round(value.toNumber());
  }
  // Strip formatting from string
  const cleaned = String(value)
    .replace(/[₡$]/g, '')
    .replace(/,/g, '')
    .trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
}

export function formatColones(amount: number | string | any): string {
  const num = parseCurrencyCRC(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
  return `₡${formatted}`;
}

export function calcularTotalCita(servicios: { precio: number | string | any }[] | any[]): number {
  if (!Array.isArray(servicios)) return 0;
  return servicios.reduce((sum, s) => {
    // Acepta tanto un objeto con propiedad precio como un valor directo
    const precio = s && typeof s === 'object' ? s.precio : s;
    return sum + parseCurrencyCRC(precio);
  }, 0);
}

export function formatTo12h(timeStr: string): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${h}:${m} ${ampm}`;
}
