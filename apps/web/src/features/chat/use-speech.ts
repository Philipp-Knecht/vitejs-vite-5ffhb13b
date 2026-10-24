import { useCallback, useEffect, useRef, useState } from 'react';

/** The part of the Web Speech API the chat uses (not in TypeScript's DOM types). */
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

type RecognitionConstructor = new () => Recognition;

function recognitionClass(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  'not-allowed':
    'Der Browser darf das Mikrofon nicht nutzen. Du kannst es in den Einstellungen der Seite erlauben.',
  'service-not-allowed': 'Die Spracheingabe ist in diesem Browser nicht erlaubt.',
  'no-speech': 'Ich habe nichts gehört. Versuch es noch einmal.',
  network: 'Für die Spracheingabe braucht der Browser eine Internetverbindung.',
  'audio-capture': 'Kein Mikrofon gefunden.',
};

/**
 * Speech input through the browser's own recognition (Web Speech API), in
 * German. The browser decides where the audio goes – Chrome, for example,
 * sends it to a Google service; the chat says so next to the button.
 */
export function useSpeech(onText: (text: string) => void) {
  const supported = recognitionClass() !== null;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onText);
  useEffect(() => {
    callback.current = onText;
  }, [onText]);
  useEffect(() => () => recognition.current?.abort(), []);

  const start = useCallback(() => {
    const Class = recognitionClass();
    if (!Class) return;
    recognition.current?.abort();
    const current = new Class();
    current.lang = 'de-DE';
    current.interimResults = true;
    current.continuous = false;
    current.onresult = (event) => {
      let text = '';
      for (let i = 0; i < event.results.length; i += 1)
        text += event.results[i]?.[0].transcript ?? '';
      callback.current(text);
    };
    current.onerror = (event) => {
      if (event.error !== 'aborted')
        setError(ERRORS[event.error] ?? 'Die Spracheingabe hat nicht geklappt.');
    };
    current.onend = () => setListening(false);
    recognition.current = current;
    setError(null);
    setListening(true);
    try {
      current.start();
    } catch {
      setListening(false);
      setError('Die Spracheingabe hat nicht geklappt.');
    }
  }, []);

  const stop = useCallback(() => recognition.current?.stop(), []);

  return { supported, listening, error, start, stop };
}
