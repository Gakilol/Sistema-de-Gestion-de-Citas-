'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface PhoneInputProps {
  value: string; // Recibe el formato internacional (ej. "50588887777") o vacío
  onChange: (formattedValue: string, isValid: boolean) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const COUNTRIES = [
  { code: '505', name: 'Nicaragua', flag: '🇳🇮', placeholder: '8888-7777' },
  { code: '506', name: 'Costa Rica', flag: '🇨🇷', placeholder: '8888-7777' },
];

export function PhoneInput({ value, onChange, disabled = false, className, placeholder }: PhoneInputProps) {
  const [countryCode, setCountryCode] = useState('505'); // Nicaragua por defecto
  const [phoneNumber, setPhoneNumber] = useState('');

  // Sincronizar el valor inicial e internacional recibido
  useEffect(() => {
    if (!value) {
      setPhoneNumber('');
      return;
    }

    // Limpiar caracteres no numéricos
    const cleanVal = value.replace(/\D/g, '');

    if (cleanVal.startsWith('505') && cleanVal.length >= 11) {
      setCountryCode('505');
      setPhoneNumber(cleanVal.slice(3));
    } else if (cleanVal.startsWith('506') && cleanVal.length >= 11) {
      setCountryCode('506');
      setPhoneNumber(cleanVal.slice(3));
    } else if (cleanVal.length === 8) {
      // Si no tiene código de país pero mide 8, conservar el country actual y rellenar
      setPhoneNumber(cleanVal);
    } else {
      // Fallback
      setPhoneNumber(cleanVal);
    }
  }, [value]);

  // Validaciones en tiempo real
  const validation = useMemo(() => {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    if (cleanNumber.length === 0) {
      return { isValid: false, message: 'El teléfono es obligatorio' };
    }
    
    if (cleanNumber.length !== 8) {
      return { isValid: false, message: 'Debe tener exactamente 8 dígitos' };
    }

    // Validaciones de prefijo específicos
    if (countryCode === '505') {
      // Nicaragua móviles suelen empezar con 8, 7, 5, 6. Convencional con 2
      const firstDigit = cleanNumber[0];
      if (!['8', '7', '5', '6', '2'].includes(firstDigit)) {
        return { isValid: false, message: 'Prefijo no válido para Nicaragua' };
      }
    } else if (countryCode === '506') {
      // Costa Rica móviles suelen empezar con 8, 7, 6. Convencional con 2 o 4
      const firstDigit = cleanNumber[0];
      if (!['8', '7', '6', '5', '2', '4'].includes(firstDigit)) {
        return { isValid: false, message: 'Prefijo no válido para Costa Rica' };
      }
    }

    return { isValid: true, message: 'Teléfono válido' };
  }, [phoneNumber, countryCode]);

  // Manejar el cambio del número telefónico
  const handlePhoneChange = (val: string) => {
    // Permitir solo números y guiones, pero guardar solo dígitos
    const cleanDigits = val.replace(/\D/g, '').slice(0, 8);
    setPhoneNumber(cleanDigits);

    const fullFormatted = cleanDigits ? `${countryCode}${cleanDigits}` : '';
    const isValid = cleanDigits.length === 8 && (
      (countryCode === '505' && ['8', '7', '5', '6', '2'].includes(cleanDigits[0])) ||
      (countryCode === '506' && ['8', '7', '6', '5', '2', '4'].includes(cleanDigits[0]))
    );
    onChange(fullFormatted, isValid);
  };

  // Manejar el cambio de país
  const handleCountryChange = (code: string) => {
    setCountryCode(code);
    const fullFormatted = phoneNumber ? `${code}${phoneNumber}` : '';
    const isValid = phoneNumber.length === 8 && (
      (code === '505' && ['8', '7', '5', '6', '2'].includes(phoneNumber[0])) ||
      (code === '506' && ['8', '7', '6', '5', '2', '4'].includes(phoneNumber[0]))
    );
    onChange(fullFormatted, isValid);
  };

  // Formatear visualmente con guion (ej. 8888-7777)
  const getDisplayValue = () => {
    if (phoneNumber.length <= 4) return phoneNumber;
    return `${phoneNumber.slice(0, 4)}-${phoneNumber.slice(4)}`;
  };

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode) || COUNTRIES[0];

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        {/* Selector de país */}
        <div className="relative shrink-0">
          <select
            value={countryCode}
            disabled={disabled}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="h-10 rounded-lg border border-border bg-card px-2.5 text-sm font-semibold flex items-center justify-center gap-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring select-none appearance-none pr-6 text-foreground"
            style={{ minWidth: '85px' }}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} +{c.code}
              </option>
            ))}
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-[10px]">▼</span>
        </div>

        {/* Input de teléfono */}
        <div className="relative flex-1">
          <Input
            type="text"
            inputMode="numeric"
            disabled={disabled}
            value={getDisplayValue()}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder={placeholder || selectedCountry.placeholder}
            className={cn(
              'pr-8 bg-card transition-all font-medium text-foreground',
              phoneNumber.length > 0 && (validation.isValid ? 'border-emerald-500/50 focus-visible:ring-emerald-500/20' : 'border-red-500/50 focus-visible:ring-red-500/20'),
              className
            )}
          />
          {/* Indicadores de Validación */}
          {phoneNumber.length > 0 && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
              {validation.isValid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" title="Número de teléfono válido" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500" title={validation.message} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mensaje de error elegante */}
      {phoneNumber.length > 0 && !validation.isValid && (
        <p className="text-[10px] font-medium text-red-500 ml-1.5 animate-in fade-in duration-200">
          ⚠️ {validation.message}
        </p>
      )}
    </div>
  );
}
