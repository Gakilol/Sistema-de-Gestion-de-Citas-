'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  processLocally?: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type LocalAvailabilityState = 'available' | 'downloadable' | 'downloading' | 'unavailable';

interface RecognitionConstructor {
  new (): Recognition;
  available?: (options: { langs: string[]; processLocally?: boolean }) => Promise<LocalAvailabilityState>;
  install?: (options: { langs: string[]; processLocally?: boolean }) => Promise<boolean>;
}

type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

export type DictationPrivacyMode =
  | 'checking'
  | 'local'
  | 'downloadable'
  | 'browser-service'
  | 'unsupported';

const PREFERRED_LOCALES = ['es-CR', 'es-MX', 'es-US', 'es-ES'];

export function useDictation(
  onTranscript: (text: string, meta: { isFinal: boolean }) => void,
  onBeforeStart?: () => void,
) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [privacyMode, setPrivacyMode] = useState<DictationPrivacyMode>('checking');
  const [localLocale, setLocalLocale] = useState<string>('es-CR');
  const [allowExternalDictation, setAllowExternalDictation] = useState(false);
  const [needsExternalConsent, setNeedsExternalConsent] = useState(false);
  const [installingPack, setInstallingPack] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState('');

  const recognition = useRef<Recognition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callback = useRef(onTranscript);
  const beforeStart = useRef(onBeforeStart);

  useEffect(() => {
    callback.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    beforeStart.current = onBeforeStart;
  }, [onBeforeStart]);

  useEffect(() => {
    let active = true;
    const browser = window as SpeechWindow;
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;

    if (!Constructor) {
      setSupported(false);
      setPrivacyMode('unsupported');
      return;
    }

    setSupported(true);

    async function probeLocalRecognition() {
      if (typeof Constructor?.available !== 'function') {
        if (active) setPrivacyMode('browser-service');
        return;
      }

      let downloadableLocale: string | null = null;
      for (const locale of PREFERRED_LOCALES) {
        try {
          const state = await Constructor.available({ langs: [locale], processLocally: true });
          if (!active) return;
          if (state === 'available') {
            setLocalLocale(locale);
            setPrivacyMode('local');
            return;
          }
          if ((state === 'downloadable' || state === 'downloading') && !downloadableLocale) {
            downloadableLocale = locale;
          }
        } catch {
          // Ignore probe errors for unsupported signature variants and fall back safely
        }
      }

      if (!active) return;
      if (downloadableLocale) {
        setLocalLocale(downloadableLocale);
        setPrivacyMode('downloadable');
      } else {
        setPrivacyMode('browser-service');
      }
    }

    void probeLocalRecognition();

    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
      if (recognition.current) {
        recognition.current.onend = null;
        recognition.current.onerror = null;
        recognition.current.onresult = null;
        recognition.current.abort();
      }
    };
  }, []);

  const installLocalPack = useCallback(async () => {
    const browser = window as SpeechWindow;
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor?.install || installingPack) return false;
    setInstallingPack(true);
    setError('');
    try {
      const ok = await Constructor.install({ langs: [localLocale], processLocally: true });
      if (ok) {
        setPrivacyMode('local');
        setNeedsExternalConsent(false);
        return true;
      }
      setError('No se pudo instalar el paquete de voz local. Puedes escribir tu solicitud con total privacidad.');
      return false;
    } catch {
      setError('No se pudo descargar el paquete de voz local en este navegador.');
      return false;
    } finally {
      setInstallingPack(false);
    }
  }, [installingPack, localLocale]);

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    recognition.current?.abort();
    setListening(false);
    setInterimText('');
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const start = useCallback(
    (forceConsent = false) => {
      if (listening) return false;
      const browser = window as SpeechWindow;
      const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
      if (!Constructor) {
        setError('Este navegador no admite reconocimiento de voz. Puedes escribir tu solicitud.');
        return false;
      }

      const isLocal = privacyMode === 'local';
      if (!isLocal && !allowExternalDictation && !forceConsent) {
        setNeedsExternalConsent(true);
        return false;
      }

      if (forceConsent) {
        setAllowExternalDictation(true);
        setNeedsExternalConsent(false);
      }

      beforeStart.current?.();

      const engine = new Constructor();
      recognition.current = engine;
      engine.lang = isLocal ? localLocale : 'es-CR';
      engine.interimResults = true;
      engine.continuous = false;
      if (isLocal) {
        engine.processLocally = true;
      }

      let finalTranscript = '';
      setError('');
      setInterimText('');

      engine.onresult = event => {
        let interim = '';
        let receivedFinal = false;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += `${event.results[i][0].transcript} `;
            receivedFinal = true;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setInterimText(interim.trim());
        const combined = `${finalTranscript}${interim}`.trim().slice(0, 1500);
        callback.current(combined, { isFinal: receivedFinal && !interim.trim() });
      };

      engine.onerror = event => {
        if (event.error === 'aborted') return;
        setError(
          event.error === 'not-allowed' || event.error === 'service-not-allowed'
            ? 'Permite el micrófono en los ajustes del navegador o escribe tu consulta.'
            : event.error === 'no-speech'
              ? 'No escuché ninguna palabra. Puedes intentarlo de nuevo o escribir tu mensaje.'
              : event.error === 'language-not-supported'
                ? 'El idioma español local no está disponible en este dispositivo. Puedes escribir tu consulta.'
                : 'El dictado no está disponible ahora. Puedes continuar escribiendo.',
        );
      };

      engine.onend = () => {
        setListening(false);
        setInterimText('');
        if (timer.current) clearTimeout(timer.current);
      };

      try {
        engine.start();
        setListening(true);
        timer.current = setTimeout(() => engine.stop(), 30000);
        return true;
      } catch {
        setListening(false);
        setError('No se pudo iniciar el micrófono. Intenta otra vez.');
        return false;
      }
    },
    [allowExternalDictation, listening, localLocale, privacyMode],
  );

  const enableExternalAndStart = useCallback(() => {
    return start(true);
  }, [start]);

  const dismissConsent = useCallback(() => {
    setNeedsExternalConsent(false);
  }, []);

  return {
    supported,
    privacyMode,
    localLocale,
    allowExternalDictation,
    setAllowExternalDictation,
    needsExternalConsent,
    installingPack,
    listening,
    interimText,
    error,
    start,
    stop,
    cancel,
    installLocalPack,
    enableExternalAndStart,
    dismissConsent,
  };
}
