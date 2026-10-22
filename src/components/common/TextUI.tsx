import React from 'react';
import { Text, Platform, StyleSheet, TextStyle, StyleProp, I18nManager } from 'react-native';

interface TextUIProps {
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
  weight?: 'regular' | 'medium' | 'bold';
  size?: number;
  color?: string;
  align?: 'left' | 'right' | 'center' | 'justify';
  quran?: boolean;
  numberOfLines?: number;
  onPress?: (event?: any) => void;
  fontsLoaded?: boolean;
  isRTL?: boolean;
}

export const TextUI: React.FC<TextUIProps> = ({
  children,
  style,
  weight = 'regular',
  size = 15,
  color,
  align,
  quran = false,
  numberOfLines,
  onPress,
  fontsLoaded = true,
  isRTL = true
}) => {
  let fontFamily: string | undefined = undefined;
  let fontWeight: any = weight === 'bold' ? '700' : weight === 'medium' ? '500' : '400';

  if (Platform.OS === 'web') {
    fontFamily = quran ? 'Amiri, serif' : 'Tajawal, "Noto Sans Arabic", -apple-system, sans-serif';
  } else if (fontsLoaded) {
    fontFamily = quran
      ? (weight === 'bold' ? 'Amiri_700Bold' : 'Amiri_400Regular')
      : (weight === 'bold' ? 'Tajawal_700Bold' : weight === 'medium' ? 'Tajawal_500Medium' : 'Tajawal_400Regular');
    // On native iOS/Android, specifying font file already encapsulates weight
    fontWeight = undefined;
  }

  const flatStyle = StyleSheet.flatten(style) || {};
  const explicitAlign = align || flatStyle.textAlign;
  const targetAlign = explicitAlign || (isRTL ? 'right' : 'left');

  let resolvedAlign: any = targetAlign;
  if (Platform.OS === 'ios' && (I18nManager.isRTL || isRTL)) {
    if (targetAlign === 'right') resolvedAlign = 'left';
    else if (targetAlign === 'left') resolvedAlign = 'right';
  }

  const { textAlign: _ignored, ...restStyle } = flatStyle;

  return (
    <Text
      numberOfLines={numberOfLines}
      onPress={onPress}
      style={[
        restStyle,
        {
          fontSize: size,
          color: color || (quran ? '#2D1E16' : '#2D1E16'),
          textAlign: resolvedAlign,
          fontFamily,
          fontWeight,
          writingDirection: isRTL ? 'rtl' : 'ltr',
          ...(Platform.OS === 'web' && isRTL ? { direction: 'rtl' as any } : {})
        }
      ]}
    >
      {children}
    </Text>
  );
};
