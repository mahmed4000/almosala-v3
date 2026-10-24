import React, { useState, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Header } from '../components/common/Header';
import { TextUI } from '../components/common/TextUI';
import { AZKAR_DATABASE } from '../data/azkarData';
import { toArabicNumber } from '../services/prayerCalculation';
import { TOKENS, makeShadow } from '../constants/tokens';

export const AzkarSessionScreen: React.FC = () => {
  const { goBack, theme, themeMode, t, screenParams, triggerHaptic, isRTL } = useApp();
  const { width: windowWidth } = useWindowDimensions();
  const c = theme;

  const category = screenParams?.category || { id: 'morning', titleAr: 'أذكار الصباح' };
  const azkarList = AZKAR_DATABASE[category.id] || AZKAR_DATABASE.morning;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [counter, setCounter] = useState(0);

  const safeIndex = currentIndex % azkarList.length;
  const currentItem = azkarList[safeIndex];
  const target = currentItem?.target || 1;
  const isCompleted = counter >= target;

  // Swipe gesture references using useRef (prevents closures bugs!)
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  const handleTap = () => {
    if (counter < target) {
      const next = counter + 1;
      setCounter(next);
      triggerHaptic('light');
      if (next >= target) {
        triggerHaptic('success');
      }
    }
  };

  const handleNext = () => {
    triggerHaptic('light');
    if (currentIndex + 1 < azkarList.length) {
      setCurrentIndex((prev) => prev + 1);
      setCounter(0);
    }
  };

  const handlePrev = () => {
    triggerHaptic('light');
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setCounter(0);
    }
  };

  const onTouchStart = (e: any) => {
    try {
      const touch = e.nativeEvent?.touches?.[0] || e.nativeEvent;
      touchStartXRef.current = touch?.pageX ?? touch?.clientX ?? 0;
      touchStartYRef.current = touch?.pageY ?? touch?.clientY ?? 0;
    } catch (err) {}
  };

  const onTouchEnd = (e: any) => {
    try {
      const touch = e.nativeEvent?.changedTouches?.[0] || e.nativeEvent;
      const endX = touch?.pageX ?? touch?.clientX ?? 0;
      const endY = touch?.pageY ?? touch?.clientY ?? 0;
      const deltaX = endX - touchStartXRef.current;
      const deltaY = endY - touchStartYRef.current;

      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) {
          isRTL ? handlePrev() : handleNext();
        } else {
          isRTL ? handleNext() : handlePrev();
        }
      }
    } catch (err) {}
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: c.bg }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <Header
        title={category.titleAr}
        subtitle={`الذكر ${toArabicNumber(currentIndex + 1)} من ${toArabicNumber(azkarList.length)}`}
        onBack={goBack}
      />

      {/* Progress Bar */}
      <View style={{ height: 4, width: '100%', backgroundColor: c.border }}>
        <View
          style={{
            height: '100%',
            width: `${((currentIndex + 1) / azkarList.length) * 100}%`,
            backgroundColor: TOKENS.colors.primary
          }}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 110, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        {/* Zikr Arabic Text Card */}
        <View
          style={{
            width: '100%',
            backgroundColor: c.surface,
            borderRadius: 22,
            padding: 24,
            borderWidth: 1,
            borderColor: isCompleted ? TOKENS.colors.secondary : c.border,
            marginBottom: 20,
            ...makeShadow('0 4px 16px rgba(0,0,0,0.03)', '#000', 0.03, 4)
          }}
        >
          <TextUI
            variant="quranVerse"
            size={20}
            color={c.textPrimary}
            style={{ lineHeight: 36, textAlign: 'center', marginBottom: 16 }}
          >
            {currentItem?.ar || ''}
          </TextUI>

          {/* Virtue & Reward */}
          {currentItem?.virtue ? (
            <View
              style={{
                backgroundColor: themeMode === 'light' ? TOKENS.colors.secondaryLight : '#382E28',
                borderRadius: 14,
                padding: 12,
                marginTop: 8,
                borderWidth: 1,
                borderColor: TOKENS.colors.secondary
              }}
            >
              <TextUI variant="caption" color={TOKENS.colors.primaryDark} style={{ textAlign: 'center', lineHeight: 18 }}>
                ✨ {currentItem.virtue}
              </TextUI>
            </View>
          ) : null}
        </View>

        {/* Big Interactive Tap Counter */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={handleTap}
          style={{
            width: 130,
            height: 130,
            borderRadius: 65,
            backgroundColor: isCompleted ? '#4CAF50' : TOKENS.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 4,
            borderColor: '#FFFFFF',
            marginBottom: 24,
            ...makeShadow(
              isCompleted ? '0 8px 24px rgba(76, 175, 80, 0.4)' : '0 8px 24px rgba(140, 94, 60, 0.4)',
              isCompleted ? '#4CAF50' : TOKENS.colors.primary,
              0.4,
              10
            )
          }}
        >
          {isCompleted ? (
            <Feather name="check" size={44} color="#FFFFFF" />
          ) : (
            <View style={{ alignItems: 'center' }}>
              <TextUI size={32} weight="bold" color="#FFFFFF">
                {toArabicNumber(counter)}
              </TextUI>
              <TextUI size={12} color="rgba(255,255,255,0.85)">
                من {toArabicNumber(target)}
              </TextUI>
            </View>
          )}
        </TouchableOpacity>

        {/* Navigation Buttons (Prev / Next) */}
        <View style={{ flexDirection: 'row', gap: 16, width: '100%', maxWidth: 320 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePrev}
            disabled={currentIndex === 0}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: c.surface,
              paddingVertical: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: c.border,
              opacity: currentIndex === 0 ? 0.4 : 1
            }}
          >
            <Feather name="arrow-right" size={16} color={c.textPrimary} />
            <TextUI size={13} weight="bold" color={c.textPrimary}>
              {t('السابق', 'Previous')}
            </TextUI>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleNext}
            disabled={currentIndex === azkarList.length - 1}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: isCompleted ? TOKENS.colors.primary : c.surface,
              paddingVertical: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: isCompleted ? TOKENS.colors.primary : c.border,
              opacity: currentIndex === azkarList.length - 1 ? 0.4 : 1
            }}
          >
            <TextUI size={13} weight="bold" color={isCompleted ? '#FFFFFF' : c.textPrimary}>
              {t('التالي', 'Next')}
            </TextUI>
            <Feather name="arrow-left" size={16} color={isCompleted ? '#FFFFFF' : c.textPrimary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};
