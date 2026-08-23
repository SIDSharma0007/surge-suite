import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Strips Markdown syntax so text sounds natural when spoken by TTS
 */
export const cleanMarkdownForSpeech = (markdownText) => {
  if (!markdownText || typeof markdownText !== 'string') return '';

  return markdownText
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, ' [Code block omitted] ')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    // Remove links but keep text: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // Remove headers (# Header)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove blockquotes (> quote)
    .replace(/^>\s+/gm, '')
    // Remove bold/italics (***text***, **text**, *text*, ___text___, __text__, _text_)
    .replace(/(\*{1,3}|_{1,3})([^*_]+)\1/g, '$2')
    // Remove horizontal rules
    .replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '')
    // Remove bullet points / numbering at start of line
    .replace(/^(\s*[-*+]|\s*\d+\.)\s+/gm, '')
    // Remove table formatting (pipes)
    .replace(/\|/g, ' ')
    // Collapse multiple whitespace/newlines
    .replace(/\s+/g, ' ')
    .trim();
};

export const useSpeechSynthesis = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [voices, setVoices] = useState([]);
  const [currentText, setCurrentText] = useState('');

  const utteranceRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const updateVoices = () => {
      try {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
      } catch (err) {
        console.warn('Failed to load speech synthesis voices:', err);
      }
    };

    updateVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    };
  }, []);

  const findBestVoice = useCallback((langCode) => {
    if (!voices || voices.length === 0) return null;
    const cleanLang = (langCode || 'en-US').toLowerCase();
    const primaryTag = cleanLang.split('-')[0];

    // 1. Exact match (e.g. "hi-IN", "bn-IN", "ta-IN", "zh-CN")
    const exact = voices.find((v) => v.lang.toLowerCase() === cleanLang || v.lang.toLowerCase().replace('_', '-') === cleanLang);
    if (exact) return exact;

    // 2. Primary language tag match (e.g. "hi", "bn", "zh")
    const primaryMatch = voices.find((v) => v.lang.toLowerCase().startsWith(primaryTag));
    if (primaryMatch) return primaryMatch;

    // 3. Fallback to default voice or first available
    return voices.find((v) => v.default) || voices[0];
  }, [voices]);

  const speak = useCallback((text, langCode = 'en-US', options = {}) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }

    // Cancel any ongoing utterance before speaking new text
    window.speechSynthesis.cancel();

    const spokenText = options.stripMarkdown !== false ? cleanMarkdownForSpeech(text) : text;
    if (!spokenText) return;

    try {
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.lang = langCode;
      utterance.rate = options.rate || 1.0;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;

      const voice = findBestVoice(langCode);
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
        setCurrentText(text);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentText('');
      };

      utterance.onerror = (event) => {
        console.warn('[SpeechSynthesis Error]', event.error);
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentText('');
      };

      utterance.onpause = () => {
        setIsPaused(true);
      };

      utterance.onresume = () => {
        setIsPaused(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Speech synthesis invocation failed:', err);
      setIsSpeaking(false);
    }
  }, [findBestVoice]);

  const pause = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, []);

  const cancel = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentText('');
    }
  }, []);

  return {
    speak,
    pause,
    resume,
    cancel,
    isSpeaking,
    isPaused,
    isSupported,
    currentText,
    voices,
  };
};
