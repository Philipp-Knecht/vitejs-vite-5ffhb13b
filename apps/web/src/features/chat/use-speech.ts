import { useCallback, useEffect, useRef, useState } from 'react';

/** The part of the Web Speech API the chat uses (not in TypeScript's DOM types). */
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  processLocally?: boolean;
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

type RecognitionConstructor = (new () => Recognition) & {
  /** Newer browsers: whether recognition can run on this device (experimental). */
  available?: (options: {
    langs: string[];
    processLocally: boolean;
    quality?: string;
  }) => Promise<string>;
};

const LANGUAGE = 'de-DE';

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
  'language-not-supported': 'Dein Browser erkennt hier kein Deutsch.',
};

/**
 * Speech input through the browser's own recognition (Web Speech API), in
 * German. Where the browser can recognise German on the device, the audio
 * stays there; otherwise the browser decides where it goes – Chrome, for
 * example, sends it to a Google service. The chat says which next to the button.
 */
export function useSpeech(onText: (text: string) => void) {
  const supported = recognitionClass() !== null;
  const [listening, setListening] = useState(false);
  const [local, setLocal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onText);
  useEffect(() => {
    callback.current = onText;
  }, [onText]);
  useEffect(() => () => recognition.current?.abort(), []);

  // Only a language pack that is already there: nothing is downloaded unasked.
  useEffect(() => {
    let active = true;
    try {
      void recognitionClass()
        ?.available?.({ langs: [LANGUAGE], processLocally: true, quality: 'dictation' })
        .then((status) => {
          if (active) setLocal(status === 'available');
        })
        .catch(() => undefined);
    } catch {
      // Not offered, or blocked by the page's permissions policy.
    }
    return () => {
      active = false;
    };
  }, []);

  const start = useCallback(() => {
    const Class = recognitionClass();
    if (!Class) return;
    recognition.current?.abort();
    const current = new Class();
    current.lang = LANGUAGE;
    current.interimResults = true;
    current.continuous = false;
    if (local) current.processLocally = true;
    current.onresult = (event) => {
      if (recognition.current !== current) return;
      let text = '';
      for (let i = 0; i < event.results.length; i += 1)
        text += event.results[i]?.[0].transcript ?? '';
      callback.current(text);
    };
    current.onerror = (event) => {
      if (event.error !== 'aborted')
        setError(ERRORS[event.error] ?? 'Die Spracheingabe hat nicht geklappt.');
    };
    current.onend = () => {
      if (recognition.current === current) setListening(false);
    };
    recognition.current = current;
    setError(null);
    setListening(true);
    try {
      current.start();
    } catch {
      setListening(false);
      setError('Die Spracheingabe hat nicht geklappt.');
    }
  }, [local]);

  /** Stops listening; what was said so far still arrives. */
  const stop = useCallback(() => recognition.current?.stop(), []);

  /** Stops listening and drops what has not arrived yet (the message was sent). */
  const cancel = useCallback(() => {
    const current = recognition.current;
    recognition.current = null;
    current?.abort();
    setListening(false);
  }, []);

  return { supported, local, listening, error, start, stop, cancel };
}
