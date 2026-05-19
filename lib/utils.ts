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
