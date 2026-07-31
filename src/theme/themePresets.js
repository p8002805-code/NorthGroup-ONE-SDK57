/**
 * NorthGroup One appearance presets.
 *
 * This file is intentionally independent from React and AsyncStorage so it can
 * be introduced without changing the current working screens. The application
 * can later select a palette with getThemePalette(themeId, mode).
 *
 * The common colour keys mirror src/theme/colours.js. The additional semantic
 * keys are provided for new and refactored screens so colours do not need to be
 * hard-coded into individual components.
 */

export const THEME_STORAGE_KEY = 'northgroup_appearance_preferences';
export const DEFAULT_THEME_ID = 'northgroup';
export const DEFAULT_APPEARANCE_MODE = 'system';

export const APPEARANCE_MODES = Object.freeze({
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark',
});

const rgba = (hex, alpha) => {
  const value = String(hex).replace('#', '');
  const expanded = value.length === 3
    ? value.split('').map((part) => part + part).join('')
    : value;

  const red = parseInt(expanded.slice(0, 2), 16);
  const green = parseInt(expanded.slice(2, 4), 16);
  const blue = parseInt(expanded.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const createPalette = ({
  navy,
  navy2,
  navy3,
  accent,
  accentDark,
  accentSoft,
  background,
  surface,
  surfaceRaised,
  textPrimary,
  textSecondary,
  textMuted,
  border,
  borderStrong,
  inputBackground,
  inputBorder,
  success = '#208A4A',
  danger = '#C53B35',
  warning = '#B56B00',
  info = '#2678B8',
  isDark,
}) => ({
  // Existing NorthGroup-compatible keys.
  navy,
  navy2,
  navy3,
  gold: accent,
  goldDark: accentDark,
  goldSoft: accentSoft,
  white: '#FFFFFF',
  offWhite: isDark ? surface : background,
  textPrimary,
  textSecondary,
  textMuted,
  borderLight: border,
  borderDark: borderStrong,
  background,
  surface,
  surfaceDark: surfaceRaised,
  success,
  danger,
  warning,
  overlay: rgba(navy, 0.84),
  divider: rgba(accent, 0.46),

  // Semantic keys for new/refactored components.
  pageBackground: background,
  cardBackground: surface,
  raisedSurface: surfaceRaised,
  headerBackground: navy,
  headerSurface: navy2,
  primaryAction: accent,
  primaryActionText: isDark ? navy : '#FFFFFF',
  secondaryAction: navy2,
  secondaryActionText: '#FFFFFF',
  accent,
  accentDark,
  accentSoft,
  bodyText: textPrimary,
  supportingText: textSecondary,
  placeholderText: textMuted,
  border,
  borderStrong,
  inputBackground,
  inputBorder,
  inputText: textPrimary,
  icon: accent,
  iconMuted: textMuted,
  focusRing: rgba(accent, 0.72),
  scrim: rgba(navy, 0.62),
  info,
  successBackground: rgba(success, isDark ? 0.24 : 0.12),
  dangerBackground: rgba(danger, isDark ? 0.24 : 0.10),
  warningBackground: rgba(warning, isDark ? 0.24 : 0.12),
  infoBackground: rgba(info, isDark ? 0.24 : 0.10),
  statusSuccessText: isDark ? '#8DE5AA' : '#146B37',
  statusDangerText: isDark ? '#FFAAA3' : '#922A25',
  statusWarningText: isDark ? '#FFD38A' : '#7A4800',
  statusInfoText: isDark ? '#9ED5FF' : '#185A8A',
  shadow: isDark ? '#000000' : '#15263A',
  isDark: Boolean(isDark),
});

const themes = {
  northgroup: {
    id: 'northgroup',
    label: 'NorthGroup Standard',
    shortLabel: 'Standard',
    description: 'The signature NorthGroup navy, topo blue and gold interface.',
    mood: 'Corporate · branded · familiar',
    recommended: true,
    preview: ['#061A2D', '#09233C', '#D6A84F', '#FFFFFF'],
    palettes: {
      light: createPalette({
        navy: '#061A2D', navy2: '#09233C', navy3: '#0E203A',
        accent: '#D6A84F', accentDark: '#A8781E', accentSoft: '#F7DFA6',
        background: '#F2F5F7', surface: '#FFFFFF', surfaceRaised: '#F8FAFC',
        textPrimary: '#061A2D', textSecondary: '#51606F', textMuted: '#71808D',
        border: '#DCE3E9', borderStrong: '#A9B8C5', inputBackground: '#FFFFFF', inputBorder: '#C9D4DD',
        success: '#208A4A', danger: '#C53B35', warning: '#B56B00', info: '#2678B8', isDark: false,
      }),
      dark: createPalette({
        navy: '#061A2D', navy2: '#09233C', navy3: '#0E203A',
        accent: '#D6A84F', accentDark: '#B98525', accentSoft: '#F7DFA6',
        background: '#061A2D', surface: '#102B45', surfaceRaised: '#163653',
        textPrimary: '#F7FAFC', textSecondary: '#D1DCE6', textMuted: '#AAB9C8',
        border: '#29445F', borderStrong: '#49647E', inputBackground: '#102B45', inputBorder: '#49647E',
        success: '#30D158', danger: '#FF6257', warning: '#FFC000', info: '#55B7FF', isDark: true,
      }),
    },
  },

  midnight: {
    id: 'midnight',
    label: 'Midnight Operations',
    shortLabel: 'Midnight',
    description: 'A low-glare night-work palette with electric cyan controls.',
    mood: 'Low-light · technical · focused',
    recommended: false,
    preview: ['#090D16', '#111A29', '#42D9FF', '#E9F6FF'],
    palettes: {
      light: createPalette({
        navy: '#102131', navy2: '#173247', navy3: '#1F435A',
        accent: '#007FAD', accentDark: '#005A7A', accentSoft: '#B9ECFA',
        background: '#EEF5F8', surface: '#FFFFFF', surfaceRaised: '#F7FBFC',
        textPrimary: '#0C1B28', textSecondary: '#456171', textMuted: '#6F8895',
        border: '#D0E0E7', borderStrong: '#91AEBB', inputBackground: '#FFFFFF', inputBorder: '#B7CED8',
        success: '#187A47', danger: '#B43238', warning: '#9C5B00', info: '#176DAA', isDark: false,
      }),
      dark: createPalette({
        navy: '#090D16', navy2: '#111A29', navy3: '#19263A',
        accent: '#42D9FF', accentDark: '#0EB2D8', accentSoft: '#B9F3FF',
        background: '#090D16', surface: '#111A29', surfaceRaised: '#1A293D',
        textPrimary: '#E9F6FF', textSecondary: '#BCD1DE', textMuted: '#8097A8',
        border: '#263B50', borderStrong: '#3E5D74', inputBackground: '#111A29', inputBorder: '#3E5D74',
        success: '#52E18B', danger: '#FF777D', warning: '#FFD166', info: '#42D9FF', isDark: true,
      }),
    },
  },

  slate: {
    id: 'slate',
    label: 'Surveyor Slate',
    shortLabel: 'Slate',
    description: 'A calm neutral workspace designed for long field days and clear forms.',
    mood: 'Calm · readable · practical',
    recommended: false,
    preview: ['#202B35', '#334452', '#E08E45', '#F7F8F6'],
    palettes: {
      light: createPalette({
        navy: '#202B35', navy2: '#334452', navy3: '#415766',
        accent: '#C86F2C', accentDark: '#984C18', accentSoft: '#F6D3B5',
        background: '#F1F3F2', surface: '#FFFFFF', surfaceRaised: '#F8FAF9',
        textPrimary: '#202B35', textSecondary: '#556570', textMuted: '#7C8A92',
        border: '#D8DFE2', borderStrong: '#AAB8BF', inputBackground: '#FFFFFF', inputBorder: '#C2CDD2',
        success: '#287A4D', danger: '#B33A37', warning: '#9A5A00', info: '#3D6F91', isDark: false,
      }),
      dark: createPalette({
        navy: '#171E25', navy2: '#202B35', navy3: '#2C3B47',
        accent: '#E08E45', accentDark: '#C86F2C', accentSoft: '#F7D4B6',
        background: '#171E25', surface: '#222E38', surfaceRaised: '#2D3C47',
        textPrimary: '#F4F7F7', textSecondary: '#CDD8DB', textMuted: '#9AAAB1',
        border: '#3A4C57', borderStrong: '#5B707B', inputBackground: '#222E38', inputBorder: '#5B707B',
        success: '#5FD58B', danger: '#FF817D', warning: '#FFD27A', info: '#8DC9EA', isDark: true,
      }),
    },
  },

  coastal: {
    id: 'coastal',
    label: 'Coastal Cyan',
    shortLabel: 'Coastal',
    description: 'Deep ocean blue with aqua highlights inspired by Queensland coastlines.',
    mood: 'Fresh · modern · energetic',
    recommended: false,
    preview: ['#063B4C', '#075A68', '#2DD4BF', '#E8FFFB'],
    palettes: {
      light: createPalette({
        navy: '#063B4C', navy2: '#075A68', navy3: '#087989',
        accent: '#008F89', accentDark: '#006B68', accentSoft: '#B7F0E8',
        background: '#EDF8F7', surface: '#FFFFFF', surfaceRaised: '#F7FCFB',
        textPrimary: '#073542', textSecondary: '#486974', textMuted: '#718D95',
        border: '#CFE5E3', borderStrong: '#8EBBB8', inputBackground: '#FFFFFF', inputBorder: '#B6D4D1',
        success: '#197A4A', danger: '#B9383A', warning: '#A56500', info: '#08749B', isDark: false,
      }),
      dark: createPalette({
        navy: '#042A36', navy2: '#063B4C', navy3: '#075A68',
        accent: '#2DD4BF', accentDark: '#12A898', accentSoft: '#A5F3E8',
        background: '#042A36', surface: '#0A4350', surfaceRaised: '#0E5A65',
        textPrimary: '#ECFFFC', textSecondary: '#C3E6E2', textMuted: '#8EB9B7',
        border: '#1B626D', borderStrong: '#3A858C', inputBackground: '#0A4350', inputBorder: '#3A858C',
        success: '#64E2A0', danger: '#FF8580', warning: '#FFD166', info: '#75DDF5', isDark: true,
      }),
    },
  },

  eucalyptus: {
    id: 'eucalyptus',
    label: 'Eucalyptus Field',
    shortLabel: 'Eucalyptus',
    description: 'Australian bush greens with warm sandstone accents for a grounded field feel.',
    mood: 'Natural · Australian · grounded',
    recommended: false,
    preview: ['#123B36', '#1E594B', '#D69B56', '#F3F7F1'],
    palettes: {
      light: createPalette({
        navy: '#123B36', navy2: '#1E594B', navy3: '#2D705C',
        accent: '#B86F2D', accentDark: '#89501C', accentSoft: '#F1D4B0',
        background: '#F1F6F1', surface: '#FFFFFF', surfaceRaised: '#F8FBF7',
        textPrimary: '#153832', textSecondary: '#526A60', textMuted: '#7B9187',
        border: '#D4E1D7', borderStrong: '#9DB5A5', inputBackground: '#FFFFFF', inputBorder: '#BED0C4',
        success: '#267A49', danger: '#B33B37', warning: '#996000', info: '#377797', isDark: false,
      }),
      dark: createPalette({
        navy: '#0B2925', navy2: '#123B36', navy3: '#1E594B',
        accent: '#D69B56', accentDark: '#B86F2D', accentSoft: '#F5DAB6',
        background: '#0B2925', surface: '#153E37', surfaceRaised: '#1E5448',
        textPrimary: '#F2FFF7', textSecondary: '#C8DED0', textMuted: '#91B0A0',
        border: '#2E6456', borderStrong: '#4B846D', inputBackground: '#153E37', inputBorder: '#4B846D',
        success: '#68DB93', danger: '#FF857C', warning: '#FFD27A', info: '#8CCDED', isDark: true,
      }),
    },
  },

  signal: {
    id: 'signal',
    label: 'High-Visibility Signal',
    shortLabel: 'Signal',
    description: 'Maximum visual separation for fast decisions and demanding site conditions.',
    mood: 'High contrast · bold · operational',
    recommended: false,
    preview: ['#171A1F', '#252B33', '#F5C400', '#FFF8D6'],
    palettes: {
      light: createPalette({
        navy: '#171A1F', navy2: '#252B33', navy3: '#333B45',
        accent: '#D49F00', accentDark: '#9A7000', accentSoft: '#FFF0A8',
        background: '#F4F5F6', surface: '#FFFFFF', surfaceRaised: '#FAFAFA',
        textPrimary: '#171A1F', textSecondary: '#4D5761', textMuted: '#75808A',
        border: '#D8DDE1', borderStrong: '#A6B0B8', inputBackground: '#FFFFFF', inputBorder: '#BBC4CA',
        success: '#1D7A42', danger: '#B2282D', warning: '#985E00', info: '#1F6C9B', isDark: false,
      }),
      dark: createPalette({
        navy: '#111318', navy2: '#171A1F', navy3: '#252B33',
        accent: '#F5C400', accentDark: '#C69B00', accentSoft: '#FFF2A6',
        background: '#111318', surface: '#1D2229', surfaceRaised: '#2A313A',
        textPrimary: '#FFFFFF', textSecondary: '#E0E5E8', textMuted: '#A8B2BA',
        border: '#3B444E', borderStrong: '#66727D', inputBackground: '#1D2229', inputBorder: '#66727D',
        success: '#62DD8C', danger: '#FF777B', warning: '#FFD166', info: '#8BCFFF', isDark: true,
      }),
    },
  },
};

export const THEME_PRESETS = Object.freeze(themes);

export const THEME_IDS = Object.freeze(Object.keys(THEME_PRESETS));

export const THEME_OPTIONS = Object.freeze(
  THEME_IDS.map((id) => {
    const theme = THEME_PRESETS[id];
    return Object.freeze({
      id: theme.id,
      label: theme.label,
      shortLabel: theme.shortLabel,
      description: theme.description,
      mood: theme.mood,
      recommended: theme.recommended,
      preview: theme.preview,
    });
  }),
);

export const MODE_OPTIONS = Object.freeze([
  { id: APPEARANCE_MODES.SYSTEM, label: 'Use iPhone setting', icon: '◐' },
  { id: APPEARANCE_MODES.LIGHT, label: 'Light mode', icon: '☀' },
  { id: APPEARANCE_MODES.DARK, label: 'Dark mode', icon: '☾' },
]);

export const resolveThemeId = (themeId) => (
  THEME_PRESETS[themeId] ? themeId : DEFAULT_THEME_ID
);

export const resolveAppearanceMode = (mode) => (
  Object.values(APPEARANCE_MODES).includes(mode) ? mode : DEFAULT_APPEARANCE_MODE
);

export const resolveColourMode = (mode, systemScheme = 'light') => {
  if (mode === APPEARANCE_MODES.DARK) return 'dark';
  if (mode === APPEARANCE_MODES.LIGHT) return 'light';
  return String(systemScheme).toLowerCase() === 'dark' ? 'dark' : 'light';
};

export const getThemeDefinition = (themeId = DEFAULT_THEME_ID) => (
  THEME_PRESETS[resolveThemeId(themeId)]
);

export const getThemePalette = (
  themeId = DEFAULT_THEME_ID,
  mode = DEFAULT_APPEARANCE_MODE,
  systemScheme = 'light',
) => {
  const definition = getThemeDefinition(themeId);
  const resolvedMode = resolveColourMode(resolveAppearanceMode(mode), systemScheme);
  return definition.palettes[resolvedMode];
};

export const getThemePreview = (themeId = DEFAULT_THEME_ID, mode = 'dark') => {
  const definition = getThemeDefinition(themeId);
  const resolvedMode = mode === 'light' ? 'light' : 'dark';
  const palette = definition.palettes[resolvedMode];

  return {
    id: definition.id,
    label: definition.label,
    mode: resolvedMode,
    background: palette.background,
    surface: palette.surface,
    header: palette.headerBackground,
    accent: palette.accent,
    text: palette.textPrimary,
    supportingText: palette.textSecondary,
    preview: definition.preview,
  };
};

export const normaliseAppearance = (appearance = {}) => ({
  themeId: resolveThemeId(appearance.themeId),
  mode: resolveAppearanceMode(appearance.mode),
});

export const createAppearancePreviewCards = (mode = 'dark') => (
  THEME_IDS.map((themeId) => getThemePreview(themeId, mode))
);

export default THEME_PRESETS;
