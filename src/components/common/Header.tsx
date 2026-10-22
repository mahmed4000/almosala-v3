import React from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { TextUI } from './TextUI';
import { TOKENS } from '../../constants/tokens';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  theme?: any;
  isRTL?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightAction,
  theme,
  isRTL = true
}) => {
  const c = theme || TOKENS.colors.light;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 16,
        paddingBottom: 14,
        backgroundColor: c.bg,
        borderBottomWidth: 1,
        borderColor: c.border
      }}
    >
      {/* Right Edge (RTL): Back Button */}
      <View style={{ minWidth: 42, alignItems: 'flex-start', justifyContent: 'center' }}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              width: 38,
              height: 38,
              borderRadius: TOKENS.radius.pill,
              backgroundColor: c.surface,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: c.border
            }}
          >
            <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={18} color={c.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      {/* Center: Title & Subtitle */}
      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
        <TextUI size={17} weight="bold" color={c.textPrimary} numberOfLines={1}>
          {title}
        </TextUI>
        {subtitle ? (
          <TextUI size={12} color={c.textSecondary} style={{ marginTop: 2 }} numberOfLines={1}>
            {subtitle}
          </TextUI>
        ) : null}
      </View>

      {/* Left Edge: Optional rightAction or placeholder */}
      <View style={{ minWidth: 42, alignItems: 'flex-end', justifyContent: 'center' }}>
        {rightAction || <View style={{ width: 38 }} />}
      </View>
    </View>
  );
};
