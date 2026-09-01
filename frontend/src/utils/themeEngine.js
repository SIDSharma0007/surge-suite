/**
 * Surge Suite — Dynamic Theme & Color Engine
 * 
 * Provides mathematical color parsing, normalization, WCAG 2.1 contrast calculation,
 * complementary hue derivation, and dynamic palette generation.
 */

// ==========================================
// 1. Math, Normalization & Parsing Helpers
// ==========================================

/**
 * Parses any color input (3-digit hex, 6-digit hex, rgb(...), rgba(...), hsl(...), hsla(...))
 * into a normalized { r, g, b, a } object with r, g, b in [0, 255] and a in [0, 1].
 */
export function parseColor(input) {
  if (!input || typeof input !== 'string') {
    return { r: 17, g: 17, b: 17, a: 1 }; // Default safe dark color
  }

  const trimmed = input.trim();

  // Hex format (#RGB or #RRGGBB)
  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length === 6) {
      const num = parseInt(hex, 16);
      if (!isNaN(num)) {
        return {
          r: (num >> 16) & 255,
          g: (num >> 8) & 255,
          b: num & 255,
          a: 1,
        };
      }
    }
  }

  // RGB / RGBA format: rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = trimmed.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i);
  if (rgbMatch) {
    return {
      r: Math.min(255, Math.max(0, parseFloat(rgbMatch[1]))),
      g: Math.min(255, Math.max(0, parseFloat(rgbMatch[2]))),
      b: Math.min(255, Math.max(0, parseFloat(rgbMatch[3]))),
      a: rgbMatch[4] !== undefined ? Math.min(1, Math.max(0, parseFloat(rgbMatch[4]))) : 1,
    };
  }

  // HSL / HSLA format: hsl(h, s%, l%) or hsla(h, s%, l%, a)
  const hslMatch = trimmed.match(/^hsla?\(\s*([0-9.]+)(?:deg)?\s*,\s*([0-9.]+)%\s*,\s*([0-9.]+)%(?:\s*,\s*([0-9.]+))?\s*\)$/i);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]);
    const s = parseFloat(hslMatch[2]);
    const l = parseFloat(hslMatch[3]);
    const a = hslMatch[4] !== undefined ? parseFloat(hslMatch[4]) : 1;
    const { r, g, b } = hslToRgb(h, s, l);
    return { r, g, b, a };
  }

  // Fallback fallback parsing
  return { r: 17, g: 17, b: 17, a: 1 };
}

/**
 * Converts RGB [0, 255] to HSL { h: [0, 360), s: [0, 100], l: [0, 100] }
 */
export function rgbToHsl(r, g, b) {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
      default:
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360) % 360,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converts HSL { h: [0, 360), s: [0, 100], l: [0, 100] } to RGB { r: [0, 255], g: [0, 255], b: [0, 255] }
 */
export function hslToRgb(h, s, l) {
  const hNorm = ((h % 360) + 360) % 360 / 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const lNorm = Math.max(0, Math.min(100, l)) / 100;

  if (sNorm === 0) {
    const val = Math.round(lNorm * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p, q, t) => {
    let tAdj = t;
    if (tAdj < 0) tAdj += 1;
    if (tAdj > 1) tAdj -= 1;
    if (tAdj < 1 / 6) return p + (q - p) * 6 * tAdj;
    if (tAdj < 1 / 2) return q;
    if (tAdj < 2 / 3) return p + (q - p) * (2 / 3 - tAdj) * 6;
    return p;
  };

  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;

  const r = Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, hNorm) * 255);
  const b = Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255);

  return { r, g, b };
}

/**
 * Converts RGB numbers to 6-digit hex string (#rrggbb)
 */
export function rgbToHex(r, g, b) {
  const toHex = (c) => {
    const hex = Math.round(Math.max(0, Math.min(255, c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts HSL numbers to hex string
 */
export function hslToHex(h, s, l) {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

// ==========================================
// 2. WCAG 2.1 Luminance & Contrast Engine
// ==========================================

/**
 * Calculates WCAG 2.1 relative luminance for an RGB color.
 * Output is in range [0, 1] where 0 is pure black and 1 is pure white.
 */
export function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const s = Math.max(0, Math.min(255, val)) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculates WCAG 2.1 contrast ratio between two colors.
 * Contrast ratio is in range [1, 21].
 */
export function getContrastRatio(color1, color2) {
  const rgb1 = typeof color1 === 'string' ? parseColor(color1) : color1;
  const rgb2 = typeof color2 === 'string' ? parseColor(color2) : color2;

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const brighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (brighter + 0.05) / (darker + 0.05);
}

/**
 * Determines whether light (#ffffff) or dark (#09090b / #111111) text provides
 * superior contrast against the given background color.
 */
export function getReadableTextColor(bgInput, lightText = '#ffffff', darkText = '#09090b') {
  const bgRgb = typeof bgInput === 'string' ? parseColor(bgInput) : bgInput;
  const lightRgb = parseColor(lightText);
  const darkRgb = parseColor(darkText);

  const contrastWithLight = getContrastRatio(bgRgb, lightRgb);
  const contrastWithDark = getContrastRatio(bgRgb, darkRgb);

  return contrastWithLight >= contrastWithDark ? lightText : darkText;
}

// ==========================================
// 3. Complementary Color Derivation
// ==========================================

/**
 * Derives a complementary color in HSL space ((hue + 180) % 360)
 * with tuned saturation and lightness for clean visual hierarchy.
 */
export function getComplementaryColor(h, s, l, mode = 'dark') {
  const compHue = (h + 180) % 360;

  // In light mode, clamp lightness so it has good contrast against light surfaces
  // In dark mode, clamp lightness so it's luminous against dark surfaces
  const compSat = Math.max(45, Math.min(s, 75));
  const compLight = mode === 'dark' ? 62 : 46;

  const compHex = hslToHex(compHue, compSat, compLight);
  const compRgb = hslToRgb(compHue, compSat, compLight);
  const compFg = getReadableTextColor(compRgb, '#ffffff', '#09090b');

  return {
    hue: compHue,
    sat: compSat,
    light: compLight,
    hex: compHex,
    rgb: compRgb,
    foreground: compFg,
    cssVar: compHex,
  };
}

// ==========================================
// 4. Exact Monochrome Palettes
// ==========================================

export const ORIGINAL_MONOCHROME_PALETTES = {
  light: {
    '--bg-app': 'linear-gradient(135deg, #ffffff 0%, #f3f3f3 100%)',
    '--bg-app-solid': '#f3f3f3',
    '--bg-primary': '#ffffff',
    '--bg-secondary': '#f4f4f6',
    '--bg-card': '#ffffff',
    '--bg-sidebar': '#f8f8fa',
    '--bg-input': '#ffffff',
    '--bg-hover': 'rgba(0, 0, 0, 0.04)',
    '--bg-active': 'rgba(0, 0, 0, 0.08)',
    '--bg-focus-ring': 'rgba(0, 0, 0, 0.06)',
    '--text-primary': '#111111',
    '--text-secondary': '#555557',
    '--text-muted': '#8e8e93',
    '--border-subtle': 'rgba(0, 0, 0, 0.06)',
    '--border-light': 'rgba(0, 0, 0, 0.05)',
    '--border-medium': 'rgba(0, 0, 0, 0.12)',
    '--border-focus': '#111111',
    '--btn-primary-bg': '#111111',
    '--btn-primary-text': '#ffffff',
    '--accent': '#111111',
    '--accent-hover': '#262626',
    '--accent-soft': 'rgba(0, 0, 0, 0.06)',
    '--accent-contrast': '#ffffff',
    '--accent-complementary': '#555557',
    '--accent-complementary-fg': '#ffffff',
    '--complementary-accent': '#555557',
    '--complementary-accent-foreground': '#ffffff',
    '--glass-bg': 'rgba(255, 255, 255, 0.65)',
    '--glass-border': 'rgba(255, 255, 255, 0.6)',
    '--glass-inner-shadow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.8)',
    '--scanner-bg-active': 'rgba(0, 0, 0, 0.01)',
    '--scanner-ring-default': 'rgba(0, 0, 0, 0.04)',
    '--status-success': '#10b981',
    '--status-error': '#ef4444',
    '--status-warning': '#f59e0b',
    '--status-info': '#3b82f6',
  },
  dark: {
    '--bg-app': 'linear-gradient(135deg, #050505 0%, #111111 100%)',
    '--bg-app-solid': '#09090b',
    '--bg-primary': '#09090b',
    '--bg-secondary': '#141417',
    '--bg-card': '#18181b',
    '--bg-sidebar': '#0e0e10',
    '--bg-input': '#1f1f23',
    '--bg-hover': 'rgba(255, 255, 255, 0.06)',
    '--bg-active': 'rgba(255, 255, 255, 0.1)',
    '--bg-focus-ring': 'rgba(255, 255, 255, 0.06)',
    '--text-primary': '#f4f4f5',
    '--text-secondary': '#a1a1aa',
    '--text-muted': '#71717a',
    '--border-subtle': 'rgba(255, 255, 255, 0.08)',
    '--border-light': 'rgba(255, 255, 255, 0.06)',
    '--border-medium': 'rgba(255, 255, 255, 0.14)',
    '--border-focus': '#ffffff',
    '--btn-primary-bg': '#f4f4f5',
    '--btn-primary-text': '#09090b',
    '--accent': '#f4f4f5',
    '--accent-hover': '#e4e4e7',
    '--accent-soft': 'rgba(255, 255, 255, 0.08)',
    '--accent-contrast': '#09090b',
    '--accent-complementary': '#a1a1aa',
    '--accent-complementary-fg': '#09090b',
    '--complementary-accent': '#a1a1aa',
    '--complementary-accent-foreground': '#09090b',
    '--glass-bg': 'rgba(18, 18, 20, 0.65)',
    '--glass-border': 'rgba(255, 255, 255, 0.06)',
    '--glass-inner-shadow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
    '--scanner-bg-active': 'rgba(255, 255, 255, 0.015)',
    '--scanner-ring-default': 'rgba(255, 255, 255, 0.04)',
    '--status-success': '#10b981',
    '--status-error': '#ef4444',
    '--status-warning': '#f59e0b',
    '--status-info': '#3b82f6',
  },
};

// ==========================================
// 5. Presets Registry
// ==========================================

export const PRESETS = [
  {
    id: 'monochrome',
    name: 'Monochrome',
    accent: '#111111',
    darkAccent: '#f4f4f5',
    description: 'Original high-contrast monochrome design',
    previewSwatches: ['#111111', '#555557', '#ffffff'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    accent: '#2563eb',
    darkAccent: '#3b82f6',
    description: 'Crisp, deep ocean blue palette',
    previewSwatches: ['#2563eb', '#f97316', '#0284c7'],
  },
  {
    id: 'violet',
    name: 'Violet',
    accent: '#7c3aed',
    darkAccent: '#8b5cf6',
    description: 'Royal violet & amethyst elegance',
    previewSwatches: ['#7c3aed', '#10b981', '#a855f7'],
  },
  {
    id: 'forest',
    name: 'Forest',
    accent: '#059669',
    darkAccent: '#10b981',
    description: 'Organic emerald & forest depth',
    previewSwatches: ['#059669', '#ec4899', '#34d399'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    accent: '#ea580c',
    darkAccent: '#f97316',
    description: 'Warm glowing amber & sunset hue',
    previewSwatches: ['#ea580c', '#0284c7', '#fb923c'],
  },
  {
    id: 'rose',
    name: 'Rose',
    accent: '#e11d48',
    darkAccent: '#f43f5e',
    description: 'Vibrant crimson & magenta rose',
    previewSwatches: ['#e11d48', '#059669', '#fb7185'],
  },
  {
    id: 'custom',
    name: 'Custom',
    accent: '#2563eb',
    description: 'User-selected custom accent color',
    previewSwatches: ['#2563eb', '#ea580c', '#6366f1'],
  },
];

// ==========================================
// 6. Dynamic Palette Generator
// ==========================================

/**
 * Generates the full CSS variable map for any accent color in light/dark mode.
 * 
 * If isMonochrome is true, returns the exact original monochrome palette.
 * Otherwise, derives a rich, accessible, harmonious palette from the accent.
 */
export function generateThemePalette(accentInput, mode = 'dark', isMonochrome = false) {
  if (isMonochrome) {
    return { ...ORIGINAL_MONOCHROME_PALETTES[mode] };
  }

  const accentRgb = parseColor(accentInput);
  const accentHex = rgbToHex(accentRgb.r, accentRgb.g, accentRgb.b);
  const { h, s, l } = rgbToHsl(accentRgb.r, accentRgb.g, accentRgb.b);

  // Derive WCAG text color on accent background
  const accentContrastText = getReadableTextColor(accentRgb, '#ffffff', '#09090b');

  // Derive complementary color
  const comp = getComplementaryColor(h, s, l, mode);

  // Compute slight accent hover variation
  const hoverLightness = mode === 'dark' ? Math.min(90, l + 7) : Math.max(10, l - 7);
  const accentHoverHex = hslToHex(h, s, hoverLightness);

  if (mode === 'dark') {
    // Dark mode surfaces (deep, subtle tinted blacks)
    const surfaceSat = Math.min(s, 16);
    const bgAppSolid = `hsl(${h}, ${surfaceSat}%, 5%)`;
    const bgPrimary = `hsl(${h}, ${surfaceSat}%, 5%)`;
    const bgSecondary = `hsl(${h}, ${Math.min(s, 18)}%, 8%)`;
    const bgCard = `hsl(${h}, ${Math.min(s, 18)}%, 9%)`;
    const bgSidebar = `hsl(${h}, ${Math.min(s, 18)}%, 6%)`;
    const bgInput = `hsl(${h}, ${Math.min(s, 18)}%, 11%)`;

    const bgAppGradient = `linear-gradient(135deg, hsl(${h}, ${Math.min(s, 20)}%, 3%) 0%, hsl(${h}, ${Math.min(s, 18)}%, 6%) 100%)`;

    const textPrimary = `hsl(${h}, 15%, 96%)`;
    const textSecondary = `hsl(${h}, 12%, 70%)`;
    const textMuted = `hsl(${h}, 10%, 52%)`;

    const borderSubtle = `hsla(${h}, 20%, 80%, 0.08)`;
    const borderLight = `hsla(${h}, 20%, 80%, 0.1)`;
    const borderMedium = `hsla(${h}, 25%, 80%, 0.16)`;
    const borderFocus = accentHex;

    const bgHover = `hsla(${h}, ${Math.min(s, 30)}%, 80%, 0.08)`;
    const bgActive = `hsla(${h}, ${Math.min(s, 30)}%, 80%, 0.14)`;
    const bgFocusRing = `hsla(${h}, ${Math.max(s, 70)}%, 60%, 0.25)`;

    const accentSoft = `hsla(${h}, ${Math.max(s, 50)}%, 60%, 0.15)`;
    const glassBg = `hsla(${h}, ${Math.min(s, 20)}%, 8%, 0.65)`;
    const glassBorder = `hsla(${h}, 30%, 80%, 0.08)`;

    return {
      '--bg-app': bgAppGradient,
      '--bg-app-solid': bgAppSolid,
      '--bg-primary': bgPrimary,
      '--bg-secondary': bgSecondary,
      '--bg-card': bgCard,
      '--bg-sidebar': bgSidebar,
      '--bg-input': bgInput,
      '--bg-hover': bgHover,
      '--bg-active': bgActive,
      '--bg-focus-ring': bgFocusRing,
      '--text-primary': textPrimary,
      '--text-secondary': textSecondary,
      '--text-muted': textMuted,
      '--border-subtle': borderSubtle,
      '--border-light': borderLight,
      '--border-medium': borderMedium,
      '--border-focus': borderFocus,
      '--btn-primary-bg': accentHex,
      '--btn-primary-text': accentContrastText,
      '--accent': accentHex,
      '--accent-hover': accentHoverHex,
      '--accent-soft': accentSoft,
      '--accent-contrast': accentContrastText,
      '--accent-complementary': comp.hex,
      '--accent-complementary-fg': comp.foreground,
      '--complementary-accent': comp.hex,
      '--complementary-accent-foreground': comp.foreground,
      '--glass-bg': glassBg,
      '--glass-border': glassBorder,
      '--glass-inner-shadow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
      '--scanner-bg-active': 'rgba(255, 255, 255, 0.015)',
      '--scanner-ring-default': 'rgba(255, 255, 255, 0.04)',
      '--status-success': '#10b981',
      '--status-error': '#ef4444',
      '--status-warning': '#f59e0b',
      '--status-info': accentHex,
    };
  } else {
    // Light mode surfaces (clean, crisp, subtle tinted whites)
    const surfaceSat = Math.min(s, 18);
    const bgAppSolid = `hsl(${h}, ${surfaceSat}%, 96%)`;
    const bgPrimary = '#ffffff';
    const bgSecondary = `hsl(${h}, ${surfaceSat}%, 95%)`;
    const bgCard = '#ffffff';
    const bgSidebar = `hsl(${h}, ${Math.min(s, 16)}%, 97.5%)`;
    const bgInput = '#ffffff';

    const bgAppGradient = `linear-gradient(135deg, #ffffff 0%, hsl(${h}, ${Math.min(s, 22)}%, 96%) 100%)`;

    const textPrimary = `hsl(${h}, 20%, 8%)`;
    const textSecondary = `hsl(${h}, 12%, 36%)`;
    const textMuted = `hsl(${h}, 8%, 56%)`;

    const borderSubtle = `hsla(${h}, 15%, 20%, 0.06)`;
    const borderLight = `hsla(${h}, 15%, 20%, 0.08)`;
    const borderMedium = `hsla(${h}, 20%, 20%, 0.14)`;
    const borderFocus = accentHex;

    const bgHover = `hsla(${h}, ${Math.min(s, 35)}%, 20%, 0.05)`;
    const bgActive = `hsla(${h}, ${Math.min(s, 35)}%, 20%, 0.09)`;
    const bgFocusRing = `hsla(${h}, ${Math.max(s, 50)}%, 50%, 0.2)`;

    const accentSoft = `hsla(${h}, ${Math.max(s, 50)}%, 50%, 0.12)`;
    const glassBg = 'rgba(255, 255, 255, 0.65)';
    const glassBorder = 'rgba(255, 255, 255, 0.6)';

    return {
      '--bg-app': bgAppGradient,
      '--bg-app-solid': bgAppSolid,
      '--bg-primary': bgPrimary,
      '--bg-secondary': bgSecondary,
      '--bg-card': bgCard,
      '--bg-sidebar': bgSidebar,
      '--bg-input': bgInput,
      '--bg-hover': bgHover,
      '--bg-active': bgActive,
      '--bg-focus-ring': bgFocusRing,
      '--text-primary': textPrimary,
      '--text-secondary': textSecondary,
      '--text-muted': textMuted,
      '--border-subtle': borderSubtle,
      '--border-light': borderLight,
      '--border-medium': borderMedium,
      '--border-focus': borderFocus,
      '--btn-primary-bg': accentHex,
      '--btn-primary-text': accentContrastText,
      '--accent': accentHex,
      '--accent-hover': accentHoverHex,
      '--accent-soft': accentSoft,
      '--accent-contrast': accentContrastText,
      '--accent-complementary': comp.hex,
      '--accent-complementary-fg': comp.foreground,
      '--complementary-accent': comp.hex,
      '--complementary-accent-foreground': comp.foreground,
      '--glass-bg': glassBg,
      '--glass-border': glassBorder,
      '--glass-inner-shadow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.8)',
      '--scanner-bg-active': 'rgba(0, 0, 0, 0.01)',
      '--scanner-ring-default': 'rgba(0, 0, 0, 0.04)',
      '--status-success': '#10b981',
      '--status-error': '#ef4444',
      '--status-warning': '#f59e0b',
      '--status-info': accentHex,
    };
  }
}
