import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  generateThemePalette, 
  PRESETS, 
  ORIGINAL_MONOCHROME_PALETTES 
} from '../utils/themeEngine';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // 1. Light/Dark mode state
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return systemPrefersDark ? 'dark' : 'light';
  });

  // 2. Preset state (monochrome, ocean, violet, forest, sunset, rose, custom)
  const [preset, setPresetState] = useState(() => {
    const saved = localStorage.getItem('themePreset');
    const isValid = PRESETS.some((p) => p.id === saved);
    return isValid ? saved : 'monochrome';
  });

  // 3. Custom accent color state
  const [accentColor, setAccentColorState] = useState(() => {
    const saved = localStorage.getItem('themeAccent');
    return saved || '#2563EB';
  });

  // Determine active accent color based on preset or custom setting
  const effectiveAccent = useMemo(() => {
    if (preset === 'custom') {
      return accentColor || '#2563EB';
    }
    const presetObj = PRESETS.find((p) => p.id === preset);
    if (!presetObj) return '#111111';
    return theme === 'dark' && presetObj.darkAccent ? presetObj.darkAccent : presetObj.accent;
  }, [preset, accentColor, theme]);

  // Compute active CSS variables palette
  const palette = useMemo(() => {
    const isMonochrome = preset === 'monochrome';
    return generateThemePalette(effectiveAccent, theme, isMonochrome);
  }, [effectiveAccent, theme, preset]);

  // Inject or remove CSS variables on document.documentElement
  useEffect(() => {
    const root = document.documentElement;

    // Manage theme class
    if (theme === 'dark') {
      root.classList.add('theme-dark');
      root.classList.remove('theme-light');
    } else {
      root.classList.add('theme-light');
      root.classList.remove('theme-dark');
    }
    localStorage.setItem('theme', theme);

    // Apply all computed CSS variables directly
    if (preset === 'monochrome') {
      // In monochrome mode, apply exact monochrome palette variables
      const monoPalette = ORIGINAL_MONOCHROME_PALETTES[theme];
      Object.entries(monoPalette).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
      localStorage.setItem('themePreset', 'monochrome');
    } else {
      // Apply dynamic palette
      Object.entries(palette).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
      localStorage.setItem('themePreset', preset);
      if (preset === 'custom') {
        localStorage.setItem('themeAccent', accentColor);
      }
    }
  }, [theme, preset, accentColor, palette]);

  // Actions
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setPreset = useCallback((presetId) => {
    const target = PRESETS.find((p) => p.id === presetId);
    if (!target) return;
    setPresetState(presetId);
    localStorage.setItem('themePreset', presetId);
    if (presetId !== 'custom') {
      setAccentColorState(target.accent);
    }
  }, []);

  const setCustomAccent = useCallback((hex) => {
    if (!hex) return;
    setAccentColorState(hex);
    setPresetState('custom');
    localStorage.setItem('themePreset', 'custom');
    localStorage.setItem('themeAccent', hex);
  }, []);

  const resetToMonochrome = useCallback(() => {
    setPresetState('monochrome');
    setAccentColorState('#111111');
    localStorage.setItem('themePreset', 'monochrome');
    localStorage.removeItem('themeAccent');
  }, []);

  const value = useMemo(() => ({
    theme,
    toggleTheme,
    preset,
    setPreset,
    accentColor,
    effectiveAccent,
    setCustomAccent,
    resetToMonochrome,
    palette,
    presets: PRESETS,
  }), [
    theme,
    toggleTheme,
    preset,
    setPreset,
    accentColor,
    effectiveAccent,
    setCustomAccent,
    resetToMonochrome,
    palette,
  ]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
