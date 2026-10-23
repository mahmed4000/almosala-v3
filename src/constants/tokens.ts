import { Platform } from 'react-native';

export const makeShadow = (
  webShadow: string,
  nativeColor: string = '#000',
  nativeOpacity: number = 0.08,
  nativeRadius: number = 4,
  nativeOffset: { width: number; height: number } = { width: 0, height: 2 },
  nativeElevation: number = 3
) => {
  if (Platform.OS === 'web') {
    return { boxShadow: webShadow };
  }
  return {
    shadowColor: nativeColor,
    shadowOffset: nativeOffset,
    shadowOpacity: nativeOpacity,
    shadowRadius: nativeRadius,
    elevation: nativeElevation
  };
};

// Kaaba Coordinates (Makkah al-Mukarramah)


export const TOKENS = {
  colors: {
    primary: '#8C5E3C',          // Warm Caramel Sandalwood / بني فاتح أصيل
    primaryDark: '#5D3A22',      // Deep Andalusian Chestnut / بني كستنائي راقي
    primaryLight: '#F5ECE1',     // Soft Creamy Sandstone / بيج عاجي دافئ
    secondary: '#C69255',        // Islamic Amber Gold / ذهب إسلامي دافئ
    secondaryLight: '#FAF1E6',   // Pale Golden Silk / عاجي مذهب ناعم
    accent: '#A66B38',           // Warm Terracotta Ochre
    success: '#4E7D5B',
    warning: '#C69255',
    error: '#B34743',
    light: {
      bg: '#FAF6F0',             // Andalusian Parchment / قرطاس أندلسي هادئ
      bgSecondary: '#F2EAE0',
      surface: '#FFFFFF',        // Pure Surface
      surfaceElevated: '#FFFFFF',
      tafsirCardBg: '#F5ECE1',   // Soft Creamy Sandstone for Tafsir Cards
      tafsirBorder: '#E8DFD5',
      quranInk: '#261912',       // Deep Andalusian Ink for Quranic Text
      textPrimary: '#2D1E16',    // Deep Andalusian Espresso / حبر عربي عميق
      textSecondary: '#7D6858',  // Warm Earth Taupe
      border: '#E8DFD5',
      heroGradient: ['#3E2010', '#5E381E', '#8C5E3C']
    },
    dark: {
      bg: '#1A1411',             // OLED Safe Dark Roast Mocha
      bgSecondary: '#221B17',
      surface: '#2C231E',        // Dark Sandalwood Surface
      surfaceElevated: '#382E28',
      tafsirCardBg: '#251C17',   // Dark Espresso Surface for Tafsir Cards
      tafsirBorder: '#3D2F26',
      quranInk: '#F5EDE4',       // Warm Cream Ink for Quranic Text
      textPrimary: '#F5EDE4',
      textSecondary: '#B5A394',
      border: '#44352D',
      heroGradient: ['#24150D', '#3D2214']
    }
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    pill: 999
  }
};

