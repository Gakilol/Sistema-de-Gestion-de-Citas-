'use client';

import { useEffect, useRef, useState } from 'react';

interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: { length: number; [index: number]: RecognitionResult } }
interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export function useDictation(onTranscript: (text: string) => void) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callback = useRef(onTranscript);
  useEffect(() => { callback.current = onTranscript; }, [onTranscript]);
  useEffect(() => {
    const browser = window as SpeechWindow;
    setSupported(Boolean(browser.SpeechRecognition || browser.webkitSpeechRecognition));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (recognition.current) {
        recognition.current.onend = null; recognition.current.onerror = null; recognition.current.onresult = null;
        recognition.current.abort();
      }
    };
  }, []);

  function stop() { recognition.current?.stop(); }
  function start() {
    if (listening) return;
    const browser = window as SpeechWindow;
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor) { setError('Este navegador no admite dictado. Puedes escribir tu consulta.'); return; }
    const engine = new Constructor();
    recognition.current = engine;
    engine.lang = 'es-CR'; engine.interimResults = true; engine.continuous = false;
    let final = '';
    setError('');
    engine.onresult = event => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += `${event.results[i][0].transcript} `;
        else interim += event.results[i][0].transcript;
      }
      callback.current(`${final}${interim}`.trim().slice(0, 1500));
    };
    engine.onerror = event => {
      if (event.error === 'aborted') return;
      setError(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Permite el micrófono en los ajustes del navegador o escribe tu consulta.'
        : event.error === 'no-speech' ? 'No escuché ninguna palabra. Puedes intentarlo de nuevo.'
          : 'El dictado no está disponible ahora. Puedes continuar escribiendo.');
    };
    engine.onend = () => { setListening(false); if (timer.current) clearTimeout(timer.current); };
    try {
      engine.start(); setListening(true);
      timer.current = setTimeout(() => engine.stop(), 30000);
    } catch { setListening(false); setError('No se pudo iniciar el micrófono. Intenta otra vez.'); }
  }
  function cancel() { recognition.current?.abort(); setListening(false); if (timer.current) clearTimeout(timer.current); }
  return { supported, listening, error, start, stop, cancel };
}
