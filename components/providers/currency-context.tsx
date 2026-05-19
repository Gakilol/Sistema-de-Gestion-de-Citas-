'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type CurrencyContextType = {
  moneda: string;
  tipoCambio: number;
  simbolo: string;
  isLoading: boolean;
  formatCurrency: (amount: number) => string;
  refreshCurrency: () => Promise<void>;
};

const defaultFormatCurrency = (amount: number) => `$ ${amount.toFixed(2)}`;

const CurrencyContext = createContext<CurrencyContextType>({
  moneda: 'USD',
  tipoCambio: 1,
  simbolo: '$',
  isLoading: true,
  formatCurrency: defaultFormatCurrency,
  refreshCurrency: async () => {},
});

export const useCurrency = () => useContext(CurrencyContext);

const MONEDA_SIMBOLO: Record<string, string> = { USD: '$', NIO: 'C$', CRC: '₡' };

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [moneda, setMoneda] = useState('USD');
  const [tipoCambio, setTipoCambio] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrency = async () => {
    try {
      const res = await fetch('/api/divisa');
      if (res.ok) {
        const data = await res.json();
        setMoneda(data.moneda ?? 'USD');
        setTipoCambio(data.moneda === 'USD' ? 1 : (data.tipoCambio ?? 36.5));
      }
    } catch (error) {
      console.error('Error fetching currency:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrency();
  }, []);

  const formatCurrencyFn = (amount: number) => {
    const convertido = moneda === 'USD' ? amount : amount * tipoCambio;
    const simbolo = MONEDA_SIMBOLO[moneda] ?? '$';
    
    // We do manual formatting instead of Intl API here to ensure we display exact symbols correctly (e.g. C$)
    return `${simbolo} ${convertido.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{
      moneda,
      tipoCambio,
      simbolo: MONEDA_SIMBOLO[moneda] ?? '$',
      isLoading,
      formatCurrency: formatCurrencyFn,
      refreshCurrency: fetchCurrency
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}
