import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Header } from '../components/common/Header';
import { TextUI } from '../components/common/TextUI';
import { AZKAR_CATEGORIES } from '../data/azkarData';
import { toArabicNumber } from '../services/prayerCalculation';
import { TOKENS, makeShadow } from '../constants/tokens';

export const AzkarCategoriesScreen: React.FC = () => {
  const { goBack, navigate, theme, themeMode, t, triggerHaptic } = useApp();
  const c = theme;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header
        title={t('حصن المسلم والأذكار', 'Azkar & Supplications')}
        subtitle={t('الأذكار اليومية الصحيحة المأثورة', 'Daily Prophetic Azkar')}
        onBack={goBack}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 12 }}>
          {AZKAR_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              activeOpacity={0.82}
              onPress={() => {
                triggerHaptic('light');
                navigate('azkar_session', { category: cat });
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: c.surface,
                borderRadius: 18,
                padding: 18,
                borderWidth: 1,
                borderColor: c.border,
                ...makeShadow('0 2px 8px rgba(0,0,0,0.03)', '#000', 0.03, 3)
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: themeMode === 'light' ? TOKENS.colors.secondaryLight : '#382E28',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14
                }}
              >
                <Feather name={cat.icon as any} size={22} color={TOKENS.colors.primary} />
              </View>

              <View style={{ flex: 1 }}>
                <TextUI size={16} weight="bold" color={c.textPrimary}>
                  {cat.titleAr}
                </TextUI>
                <TextUI size={12} color={c.textSecondary} style={{ marginTop: 2 }}>
                  {cat.subtitleAr}
                </TextUI>
              </View>

              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View
                  style={{
                    backgroundColor: themeMode === 'light' ? TOKENS.colors.primaryLight : '#382A20',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: TOKENS.radius.pill
                  }}
                >
                  <TextUI size={11} weight="bold" color={TOKENS.colors.primaryDark}>
                    {toArabicNumber(cat.count)} ذكر
                  </TextUI>
                </View>
                <Feather name="chevron-left" size={16} color={c.textSecondary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};
