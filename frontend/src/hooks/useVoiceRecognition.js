import { useState, useEffect, useRef, useCallback } from 'react';

export const VOICE_LANGUAGES = [
  { code: 'en-IN', label: 'English (India)', nativeLabel: 'English' },
  { code: 'hi-IN', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'bn-IN', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'or-IN', altCodes: ['ory-IN', 'or'], label: 'Odia (India)', nativeLabel: 'ଓଡ଼ିଆ' },
];

export const useVoiceRecognition = ({ onResult, defaultLang = 'en-IN' } = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [language, setLanguage] = useState(defaultLang);
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef(null);
  const onResultRef = useRef(onResult);
  const baseTranscriptRef = useRef('');
  const isListeningRef = useRef(false);
  const retryCountRef = useRef(0);

  // Keep onResult ref updated without triggering re-initialization
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    setIsSupported(true);

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        setError(null);
        retryCountRef.current = 0;
      };

      recognition.onresult = (event) => {
        let interimText = '';
        let newFinalText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            newFinalText += item[0].transcript + ' ';
          } else {
            interimText += item[0].transcript;
          }
        }

        if (newFinalText) {
          baseTranscriptRef.current = (baseTranscriptRef.current ? baseTranscriptRef.current.trim() + ' ' : '') + newFinalText.trim();
          setTranscript(baseTranscriptRef.current);
        }

        setInterimTranscript(interimText);

        // Immediate real-time combined text callback
        const liveCombined = (baseTranscriptRef.current ? baseTranscriptRef.current.trim() + ' ' : '') + interimText;
        if (onResultRef.current && (newFinalText || interimText)) {
          onResultRef.current(liveCombined.trim());
        }
      };

      recognition.onerror = (event) => {
        console.warn('[Voice Recognition Error]', event.error, 'Language:', language);
        
        if (event.error === 'not-allowed') {
          setError('Microphone permission was denied. Please allow microphone access in browser settings.');
          isListeningRef.current = false;
        } else if (event.error === 'no-speech') {
          // Silent interval, do not terminate state
          return;
        } else if (event.error === 'network') {
          setError('Network error occurred during speech recognition. Check internet connectivity.');
          isListeningRef.current = false;
        } else if (event.error === 'language-not-supported') {
          // Try alternative BCP-47 tag for Odia (e.g. ory-IN or or)
          const currentLangObj = VOICE_LANGUAGES.find(
            (l) => l.code === language || (l.altCodes && l.altCodes.includes(language))
          );
          
          if (currentLangObj && currentLangObj.altCodes && retryCountRef.current < currentLangObj.altCodes.length) {
            const nextTag = currentLangObj.altCodes[retryCountRef.current];
            retryCountRef.current += 1;
            console.log(`[Voice] Retrying with alternative locale tag: ${nextTag}`);
            setLanguage(nextTag);
            return;
          } else {
            setError(`Odia acoustic engine is unavailable in your browser build. You can speak in Hindi or English, or type in Odia.`);
            isListeningRef.current = false;
          }
        } else if (event.error !== 'aborted') {
          setError(`Voice error: ${event.error}`);
          isListeningRef.current = false;
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        // If user hasn't explicitly stopped, auto-restart to keep continuous listening active
        if (isListeningRef.current) {
          try {
            recognition.start();
            return;
          } catch {
            // fallback if unable to restart immediately
          }
        }
        setIsListening(false);
        isListeningRef.current = false;
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.error('Failed to initialize SpeechRecognition:', err);
      setIsSupported(false);
      setError('Could not initialize speech recognition.');
    }

    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [language]);

  const startListening = useCallback((currentInputValue = '') => {
    setError(null);
    retryCountRef.current = 0;
    baseTranscriptRef.current = currentInputValue || '';
    setTranscript(currentInputValue || '');
    setInterimTranscript('');

    if (!recognitionRef.current) {
      setError('Speech recognition is not available.');
      return;
    }

    try {
      recognitionRef.current.lang = language;
      isListeningRef.current = true;
      recognitionRef.current.start();
    } catch (err) {
      console.warn('Recognition start error:', err);
      try {
        recognitionRef.current.stop();
        setTimeout(() => {
          if (recognitionRef.current && isListeningRef.current) {
            recognitionRef.current.start();
          }
        }, 150);
      } catch {
        // ignore
      }
    }
  }, [language]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn('Recognition stop error:', err);
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const resetTranscript = useCallback(() => {
    baseTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  const changeLanguage = useCallback((newLang) => {
    retryCountRef.current = 0;
    setLanguage(newLang);
    if (recognitionRef.current) {
      recognitionRef.current.lang = newLang;
      if (isListeningRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    }
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    language,
    changeLanguage,
    startListening,
    stopListening,
    resetTranscript,
    error,
    isSupported,
    supportedLanguages: VOICE_LANGUAGES,
  };
};
