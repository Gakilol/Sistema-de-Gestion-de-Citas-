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
  optional?: boolean;
}

const COUNTRIES = [
  { code: '505', name: 'Nicaragua', flag: '🇳🇮', placeholder: '8675-7959' },
  { code: '506', name: 'Costa Rica', flag: '🇨🇷', placeholder: '8888-7777' },
];

export function PhoneInput({ value, onChange, disabled = false, className, placeholder, optional = false }: PhoneInputProps) {
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

    // Buscar si el valor recibido comienza con alguno de los códigos de país de COUNTRIES
    const matchedCountry = COUNTRIES.find(c => cleanVal.length >= 11 && cleanVal.startsWith(c.code));
    if (matchedCountry) {
      setCountryCode(matchedCountry.code);
      setPhoneNumber(cleanVal.slice(matchedCountry.code.length, matchedCountry.code.length + 8));
    } else if (cleanVal.length === 8) {
      setPhoneNumber(cleanVal);
    } else {
      setPhoneNumber(cleanVal.slice(0, 8));
    }
  }, [value]);

  // Validaciones en tiempo real
  const validation = useMemo(() => {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    if (cleanNumber.length === 0) {
      return { isValid: optional, message: optional ? '' : 'El teléfono es obligatorio' };
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
  }, [phoneNumber, countryCode, optional]);

  // Manejar el cambio del número telefónico
  const handlePhoneChange = (val: string) => {
    const cleanAll = val.replace(/\D/g, '');
    let activeCountry = countryCode;
    let cleanDigits = cleanAll;

    // Si el usuario pega un número completo con prefijo (ej: 50586757959 o +505 8675-7959)
    const matched = COUNTRIES.find(c => cleanAll.length >= 11 && cleanAll.startsWith(c.code));
    if (matched) {
      activeCountry = matched.code;
      setCountryCode(matched.code);
      cleanDigits = cleanAll.slice(matched.code.length, matched.code.length + 8);
    } else {
      cleanDigits = cleanAll.slice(0, 8);
    }

    setPhoneNumber(cleanDigits);

    const fullFormatted = cleanDigits ? `${activeCountry}${cleanDigits}` : '';
    const isValid = cleanDigits.length === 0 && optional ? true : (
      cleanDigits.length === 8 && (
        (activeCountry === '505' && ['8', '7', '5', '6', '2'].includes(cleanDigits[0])) ||
        (activeCountry === '506' && ['8', '7', '6', '5', '2', '4'].includes(cleanDigits[0]))
      )
    );
    onChange(fullFormatted, isValid);
  };

  // Manejar el cambio de país
  const handleCountryChange = (code: string) => {
    setCountryCode(code);
    const fullFormatted = phoneNumber ? `${code}${phoneNumber}` : '';
    const isValid = phoneNumber.length === 0 && optional ? true : (
      phoneNumber.length === 8 && (
        (code === '505' && ['8', '7', '5', '6', '2'].includes(phoneNumber[0])) ||
        (code === '506' && ['8', '7', '6', '5', '2', '4'].includes(phoneNumber[0]))
      )
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
                <span title="Número de teléfono válido">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </span>
              ) : (
                <span title={validation.message}>
                  <AlertCircle className="w-4 h-4 text-red-500" />
                </span>
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
