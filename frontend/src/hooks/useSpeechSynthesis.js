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

/**
 * BCP-47 fallback aliases for all 13 supported languages across different OS/browser TTS engines
 */
export const LANG_ALIASES = {
  'en-in': ['en-in', 'en-us', 'en-gb', 'en'],
  'en-us': ['en-us', 'en-in', 'en-gb', 'en'],
  'hi-in': ['hi-in', 'hi', 'hin'],
  'bn-in': ['bn-in', 'bn-bd', 'bn', 'ben'],
  'as-in': ['as-in', 'as', 'asm', 'bn-in', 'bn'],
  'or-in': ['or-in', 'ory-in', 'or', 'ory'],
  'ta-in': ['ta-in', 'ta-lk', 'ta-sg', 'ta', 'tam'],
  'te-in': ['te-in', 'te', 'tel'],
  'ur-in': ['ur-in', 'ur-pk', 'ur', 'urd', 'ar'],
  'zh-cn': ['zh-cn', 'zh-tw', 'zh-hk', 'zh', 'cmn', 'yue'],
  'ja-jp': ['ja-jp', 'ja', 'jpn'],
  'fr-fr': ['fr-fr', 'fr-ca', 'fr-be', 'fr', 'fra', 'fre'],
  'es-es': ['es-es', 'es-mx', 'es-us', 'es', 'spa'],
  'ru-ru': ['ru-ru', 'ru', 'rus'],
};

// Heuristic regex patterns for French and Spanish in Latin text
const FRENCH_HEURISTICS = /\b(le|la|les|un|une|des|est|sont|pour|dans|avec|créer|faire|rapport|fichier|bonjour|merci|s'il|vous|plaît)\b|[éèêàâçîïôûù]/i;
const SPANISH_HEURISTICS = /\b(el|la|los|las|un|una|unos|unas|es|son|para|en|con|crear|hacer|informe|archivo|hola|gracias|por|favor)\b|[áéíóúüñ¿¡]/i;

/**
 * Comprehensive Unicode script detection for all 13 supported languages
 */
export const detectScriptLanguage = (text) => {
  if (!text || typeof text !== 'string') return null;

  // 1. Bengali & Assamese
  if (/[\u0980-\u09FF]/.test(text)) {
    if (/[\u09F0\u09F1]/.test(text) || text.includes('ৰ') || text.includes('ৱ')) {
      return 'as-IN';
    }
    return 'bn-IN';
  }

  // 2. Devanagari (Hindi)
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';

  // 3. Odia
  if (/[\u0B00-\u0B7F]/.test(text)) return 'or-IN';

  // 4. Tamil
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';

  // 5. Telugu
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';

  // 6. Urdu / Perso-Arabic
  if (/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)) return 'ur-IN';

  // 7. Japanese (Hiragana / Katakana)
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja-JP';

  // 8. Chinese (CJK Ideographs)
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-CN';

  // 9. Russian (Cyrillic)
  if (/[\u0400-\u04FF]/.test(text)) return 'ru-RU';

  // 10. French (Latin with French markers)
  if (FRENCH_HEURISTICS.test(text)) return 'fr-FR';

  // 11. Spanish (Latin with Spanish markers)
  if (SPANISH_HEURISTICS.test(text)) return 'es-ES';

  return null;
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
        if (availableVoices && availableVoices.length > 0) {
          setVoices(availableVoices);
        }
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
    const aliases = LANG_ALIASES[cleanLang] || [cleanLang, primaryTag];

    // 1. Try match against alias list
    for (const alias of aliases) {
      const found = voices.find((v) => {
        const vLang = v.lang.toLowerCase().replace('_', '-');
        return vLang === alias || vLang.startsWith(alias);
      });
      if (found) return found;
    }

    // 2. Primary language match (e.g. "ta", "te", "ur", "fr", "es", "ru", "ja", "zh")
    const primaryMatch = voices.find((v) =>
      v.lang.toLowerCase().startsWith(primaryTag)
    );
    if (primaryMatch) return primaryMatch;

    // 3. For non-English languages, do NOT force English voices onto non-Latin or foreign text.
    // Leaving voice unassigned allows modern browser speech engines to synthesize the language natively.
    if (primaryTag !== 'en') {
      return null;
    }

    return voices.find((v) => v.default) || voices[0] || null;
  }, [voices]);

  const speak = useCallback((text, langCode = 'en-US', options = {}) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }

    // Cancel any ongoing speech before starting
    window.speechSynthesis.cancel();

    const spokenText =
      options.stripMarkdown !== false ? cleanMarkdownForSpeech(text) : text;
    if (!spokenText || !spokenText.trim()) return;

    // Automatic language detection if text is in a distinct script / language
    const detectedLang = detectScriptLanguage(spokenText);
    const effectiveLang =
      (langCode === 'en-US' || langCode === 'en-IN' || !langCode) && detectedLang
        ? detectedLang
        : langCode || 'en-US';

    try {
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.lang = effectiveLang;
      utterance.rate = options.rate || 1.0;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;

      const voice = findBestVoice(effectiveLang);
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
        console.warn('[SpeechSynthesis Error]', event.error, 'for lang:', effectiveLang);
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

      // Small delay prevents race conditions with cancel() in Chrome/Edge
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.warn('[SpeechSynthesis speak error]', e);
          setIsSpeaking(false);
        }
      }, 50);
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
