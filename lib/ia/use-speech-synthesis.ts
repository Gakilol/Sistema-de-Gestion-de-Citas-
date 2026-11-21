'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const PREFERRED_SPANISH_LANGS = ['es-cr', 'es-419', 'es-mx', 'es-us', 'es-es'];

function selectLocalSpanishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const localVoices = voices.filter(voice => voice.localService === true);
  if (!localVoices.length) return null;

  for (const preferred of PREFERRED_SPANISH_LANGS) {
    const exact = localVoices.find(voice => voice.lang.toLowerCase() === preferred);
    if (exact) return exact;
  }

  const anyLocalSpanish = localVoices.find(voice => voice.lang.toLowerCase().startsWith('es'));
  return anyLocalSpanish ?? null;
}

/**
 * Local-only SpeechSynthesis hook.
 * Strictly selects voices where `voice.localService === true` so client names and appointment data
 * are never sent to a remote cloud text-to-speech service.
 */
export function useSpeechSynthesis() {
  const [supported, setSupported] = useState(false);
  const [localVoice, setLocalVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [blockedRemoteOnly, setBlockedRemoteOnly] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    voiceRef.current = localVoice;
  }, [localVoice]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setSupported(false);
      return;
    }

    setSupported(true);
    const synth = window.speechSynthesis;

    const refreshVoices = () => {
      const voices = synth.getVoices();
      const chosen = selectLocalSpanishVoice(voices);
      setLocalVoice(chosen);
      setBlockedRemoteOnly(voices.length > 0 && !chosen);
    };

    refreshVoices();
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', refreshVoices);
    }

    return () => {
      if (typeof synth.removeEventListener === 'function') {
        synth.removeEventListener('voiceschanged', refreshVoices);
      }
      try {
        synth.cancel();
      } catch {
        // Ignore cleanup errors on browsers without active speech queue
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
    } finally {
      setSpeaking(false);
    }
  }, []);

  const speak = useCallback(
    (text: string, force = false): boolean => {
      if (!text.trim()) return false;
      if (!force && !enabled) return false;
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
        return false;
      }

      const synth = window.speechSynthesis;
      const chosen = voiceRef.current ?? selectLocalSpanishVoice(synth.getVoices());
      // Strict privacy guard: never speak client/appointment data through a non-local remote voice.
      if (!chosen || chosen.localService !== true) {
        return false;
      }

      try {
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = chosen;
        utterance.lang = chosen.lang || 'es-CR';
        utterance.rate = 1.02;
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        synth.speak(utterance);
        return true;
      } catch {
        setSpeaking(false);
        return false;
      }
    },
    [enabled],
  );

  return {
    supported,
    canSpeak: Boolean(supported && localVoice),
    blockedRemoteOnly,
    localVoiceName: localVoice?.name ?? null,
    enabled,
    setEnabled,
    speaking,
    speak,
    stop,
  };
}
