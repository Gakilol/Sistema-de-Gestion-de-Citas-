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

export function formatColones(amount: number | string | any): string {
  if (amount === null || amount === undefined) return '₡0';
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(num)) return '₡0';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
  return `₡${formatted}`;
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
