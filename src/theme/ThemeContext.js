import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import {
  DEFAULT_APPEARANCE_MODE,
  DEFAULT_THEME_ID,
  getThemeDefinition,
  getThemePalette,
  normaliseAppearance,
  resolveColourMode,
} from './themePresets';

const ThemeContext = createContext({
  appearance: {
    themeId: DEFAULT_THEME_ID,
    mode: DEFAULT_APPEARANCE_MODE,
  },
  theme: getThemeDefinition(DEFAULT_THEME_ID),
  colors: getThemePalette(DEFAULT_THEME_ID, DEFAULT_APPEARANCE_MODE, 'light'),
  colourMode: 'light',
  systemScheme: 'light',
});

export function ThemeProvider({ appearance, children }) {
  const systemScheme = useColorScheme() || 'light';
  const normalised = useMemo(() => normaliseAppearance({
    themeId: appearance?.themeId,
    mode: appearance?.mode || appearance?.appearanceMode,
  }), [appearance?.themeId, appearance?.mode, appearance?.appearanceMode]);

  const colourMode = resolveColourMode(normalised.mode, systemScheme);
  const theme = useMemo(
    () => getThemeDefinition(normalised.themeId),
    [normalised.themeId],
  );
  const colors = useMemo(
    () => getThemePalette(normalised.themeId, normalised.mode, systemScheme),
    [normalised.themeId, normalised.mode, systemScheme],
  );

  const value = useMemo(() => ({
    appearance: normalised,
    theme,
    colors,
    colourMode,
    systemScheme,
  }), [normalised, theme, colors, colourMode, systemScheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
