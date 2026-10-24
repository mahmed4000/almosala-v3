import React from 'react';
import { View, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { TextUI } from '../components/common/TextUI';
import { MoorishArchFrame } from '../components/common/MoorishArchFrame';
import { TOKENS, makeShadow } from '../constants/tokens';
import { getFullDateInfo } from '../services/hijriDate';

export const HomeScreen: React.FC = () => {
  const {
    navigate,
    theme,
    themeMode,
    t,
    currentCity,
    prayerTimes,
    nextPrayerInfo,
    prayerBells,
    togglePrayerBell,
    readingBookmark,
    refreshLocation
  } = useApp();

  const c = theme;
  const dateInfo = getFullDateInfo();

  const prayersList = [
    { key: 'fajr' as const, nameAr: 'الفجر', nameEn: 'Fajr', time: prayerTimes.fajr.timeStr, icon: 'sunrise' as const },
    { key: 'dhuhr' as const, nameAr: 'الظهر', nameEn: 'Dhuhr', time: prayerTimes.dhuhr.timeStr, icon: 'sun' as const },
    { key: 'asr' as const, nameAr: 'العصر', nameEn: 'Asr', time: prayerTimes.asr.timeStr, icon: 'clock' as const },
    { key: 'maghrib' as const, nameAr: 'المغرب', nameEn: 'Maghrib', time: prayerTimes.maghrib.timeStr, icon: 'sunset' as const },
    { key: 'isha' as const, nameAr: 'العشاء', nameEn: 'Isha', time: prayerTimes.isha.timeStr, icon: 'moon' as const }
  ];

  const quickFeatures = [
    { id: 'quran_index', titleAr: 'المصحف الشريف', titleEn: 'Holy Quran', icon: 'book-open', screen: 'quran_index', color: '#8C5E3C' },
    { id: 'azkar_categories', titleAr: 'حصن المسلم', titleEn: 'Azkar & Duas', icon: 'heart', screen: 'azkar_categories', color: '#5D3A22' },
    { id: 'haramain_lessons', titleAr: 'كراسي الحرمين', titleEn: 'Haramain Lessons', icon: 'mic', screen: 'haramain_lessons', color: '#1E5A3E' },
    { id: 'qibla', titleAr: 'اتجاه القبلة', titleEn: 'Qibla Direction', icon: 'compass', screen: 'qibla', color: '#C69255' },
    { id: 'zakat_calculator', titleAr: 'حاسبة الزكاة', titleEn: 'Zakat Calculator', icon: 'dollar-sign', screen: 'zakat_calculator', color: '#7B5E28' },
    { id: 'hadith_40', titleAr: 'الأربعون النووية', titleEn: '40 Hadith', icon: 'award', screen: 'hadith_40', color: '#8C5E3C' },
    { id: 'allah_names', titleAr: 'أسماء الله الحسنى', titleEn: '99 Divine Names', icon: 'star', screen: 'allah_names', color: '#A66B38' },
    { id: 'ruqyah', titleAr: 'الرقية الشرعية', titleEn: 'Islamic Ruqyah', icon: 'shield', screen: 'ruqyah', color: '#2D4F38' }
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        paddingHorizontal: 18,
        paddingTop: Platform.OS === 'ios' ? 60 : (Platform.OS === 'web' ? 46 : 18),
        paddingBottom: 110
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Top Brand Header */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextUI weight="bold" size={26} color={TOKENS.colors.primaryDark}>
              {t('المصلى', 'Al-Mosala')}
            </TextUI>
            <View
              style={{
                backgroundColor: themeMode === 'light' ? TOKENS.colors.secondaryLight : '#382E28',
                paddingHorizontal: 9,
                paddingVertical: 3,
                borderRadius: TOKENS.radius.pill,
                marginRight: 8,
                borderWidth: 1,
                borderColor: TOKENS.colors.secondary
              }}
            >
              <TextUI size={11.5} weight="bold" color={TOKENS.colors.primaryDark}>
                {t('الأندلسي', 'Pro 2026')}
              </TextUI>
            </View>
          </View>

          {/* Settings & City button */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigate('settings')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
              <Feather name="settings" size={18} color={c.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={refreshLocation}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: c.surface,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: TOKENS.radius.pill,
                borderWidth: 1,
                borderColor: c.border
              }}
            >
              <Feather name="map-pin" size={14} color={TOKENS.colors.primary} />
              <TextUI size={13} weight="medium" color={c.textPrimary}>
                {currentCity.nameAr}
              </TextUI>
            </TouchableOpacity>
          </View>
        </View>

        <MoorishArchFrame height={24} color={TOKENS.colors.secondary} opacity={0.7} />
      </View>

      {/* 2. Hero Next Prayer Card with Live Countdown */}
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => navigate('prayer_times')}
        style={{
          borderRadius: 24,
          padding: 22,
          backgroundColor: TOKENS.colors.primaryDark,
          marginBottom: 14,
          ...makeShadow('0 8px 24px rgba(93, 58, 34, 0.28)', TOKENS.colors.primaryDark, 0.25, 8)
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Feather name="clock" size={16} color={TOKENS.colors.secondary} />
              <TextUI size={15} weight="bold" color={TOKENS.colors.secondaryLight}>
                {t('الصلاة القادمة', 'Next Prayer')}
              </TextUI>
            </View>
            <TextUI size={42} weight="bold" color="#FFFFFF">
              {nextPrayerInfo.nameAr}
            </TextUI>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <TextUI size={15} weight="bold" color={TOKENS.colors.secondaryLight} style={{ marginBottom: 6 }}>
              {t('موعد الأذان', 'Adhan Time')}
            </TextUI>
            <TextUI size={30} weight="bold" color="#FFFFFF">
              {nextPrayerInfo.time}
            </TextUI>
          </View>
        </View>

        {/* Countdown Bar */}
        <View style={{ marginTop: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <TextUI size={14.5} weight="bold" color={TOKENS.colors.secondaryLight}>
              {t('الوقت المتبقي', 'Time Remaining')}
            </TextUI>
            <TextUI size={22} weight="bold" color={TOKENS.colors.secondary}>
              {nextPrayerInfo.countdownText}
            </TextUI>
          </View>

          <View style={{ height: 8, width: '100%', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 4, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: `${nextPrayerInfo.progress}%`,
                backgroundColor: TOKENS.colors.secondary,
                borderRadius: 4
              }}
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* 2.5 Hijri & Gregorian Dates Card Under The Next Prayer Hero */}
      <View
        style={{
          backgroundColor: c.surface,
          borderRadius: 18,
          paddingVertical: 14,
          paddingHorizontal: 16,
          marginBottom: 18,
          borderWidth: 1,
          borderColor: c.border,
          ...makeShadow('0 4px 16px rgba(0,0,0,0.06)', '#000', 0.06, 6)
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Hijri Date Section */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: themeMode === 'light' ? '#FFF5EA' : '#33271C',
                borderWidth: 1,
                borderColor: TOKENS.colors.secondary,
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Feather name="moon" size={20} color={TOKENS.colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <TextUI size={12.5} weight="bold" color={TOKENS.colors.primary} style={{ marginBottom: 2 }}>
                {t('التاريخ الهجري', 'Hijri')}
              </TextUI>
              <TextUI size={16.5} weight="bold" color={c.textPrimary} numberOfLines={1}>
                {dateInfo.hijriFormatted}
              </TextUI>
            </View>
          </View>

          {/* Divider */}
          <View style={{ width: 1, height: 38, backgroundColor: c.border, marginHorizontal: 10 }} />

          {/* Gregorian Date Section */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: themeMode === 'light' ? '#F0F5F2' : '#1E2D24',
                borderWidth: 1,
                borderColor: themeMode === 'light' ? '#B8D5C4' : '#2A4535',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Feather name="calendar" size={20} color={themeMode === 'light' ? '#2D6A4F' : '#52B788'} />
            </View>
            <View style={{ flex: 1 }}>
              <TextUI size={12.5} weight="bold" color={themeMode === 'light' ? '#2D6A4F' : '#52B788'} style={{ marginBottom: 2 }}>
                {t('التاريخ الميلادي', 'Gregorian')}
              </TextUI>
              <TextUI size={15.5} weight="bold" color={c.textPrimary} numberOfLines={1}>
                {dateInfo.gregorianFormatted}
              </TextUI>
            </View>
          </View>
        </View>
      </View>

      {/* 3. Daily 5 Prayers Horizontal Card Grid */}
      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <TextUI size={17} weight="bold" color={c.textPrimary}>
            {t('مواقيت الصلاة اليوم', "Today's Prayer Schedule")}
          </TextUI>
          <TouchableOpacity onPress={() => navigate('prayer_times')}>
            <TextUI size={14} weight="bold" color={TOKENS.colors.primary}>
              {t('عرض الكل', 'View All')}
            </TextUI>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
          {prayersList.map((p) => {
            const isNext = p.key === nextPrayerInfo.id;
            const hasBell = prayerBells[p.key];
            return (
              <View
                key={p.key}
                style={{
                  flex: 1,
                  backgroundColor: isNext ? (themeMode === 'light' ? TOKENS.colors.primaryLight : '#382A20') : c.surface,
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 6,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: isNext ? TOKENS.colors.primary : c.border
                }}
              >
                <Feather name={p.icon} size={18} color={isNext ? TOKENS.colors.primaryDark : c.textSecondary} />
                <TextUI size={13.5} weight={isNext ? 'bold' : 'medium'} color={isNext ? TOKENS.colors.primaryDark : c.textPrimary} style={{ marginTop: 4 }}>
                  {p.nameAr}
                </TextUI>
                <TextUI size={13} weight="bold" color={isNext ? TOKENS.colors.primaryDark : c.textSecondary} style={{ marginTop: 2 }}>
                  {p.time.split(' ')[0]}
                </TextUI>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => togglePrayerBell(p.key)}
                  style={{ marginTop: 6 }}
                >
                  <Feather
                    name={hasBell ? 'bell' : 'bell-off'}
                    size={14}
                    color={hasBell ? TOKENS.colors.secondary : c.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>

      {/* 4. Reading Bookmark Resume Banner (if available) */}
      {readingBookmark && (
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => navigate('quran_reader', { surahId: readingBookmark.surahId, ayah: readingBookmark.ayah })}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: themeMode === 'light' ? '#FFF9F2' : '#2D231C',
            borderRadius: 16,
            padding: 14,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: TOKENS.colors.secondary
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: TOKENS.colors.secondaryLight,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12
            }}
          >
            <Feather name="bookmark" size={20} color={TOKENS.colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <TextUI size={12} color={TOKENS.colors.primary}>
              {t('متابعة القراءة من حيث توقفت', 'Continue Reading')}
            </TextUI>
            <TextUI size={15} weight="bold" color={c.textPrimary}>
              {readingBookmark.surahName} • الآية {readingBookmark.ayah}
            </TextUI>
          </View>
          <Feather name="chevron-left" size={18} color={TOKENS.colors.primary} />
        </TouchableOpacity>
      )}

      {/* 5. Islamic Features Grid (2 Columns) */}
      <View style={{ marginBottom: 20 }}>
        <TextUI size={17} weight="bold" color={c.textPrimary} style={{ marginBottom: 12 }}>
          {t('الموسوعة والخدمات الإسلامية', 'Islamic Features & Services')}
        </TextUI>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {quickFeatures.map((f) => (
            <TouchableOpacity
              key={f.id}
              activeOpacity={0.85}
              onPress={() => navigate(f.screen)}
              style={{
                width: '48%',
                backgroundColor: c.surface,
                borderRadius: 16,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 1,
                borderColor: c.border,
                ...makeShadow('0 2px 8px rgba(0,0,0,0.04)', '#000', 0.04, 3)
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: themeMode === 'light' ? `${f.color}15` : `${f.color}30`,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Feather name={f.icon as any} size={20} color={f.color} />
              </View>
              <View style={{ flex: 1 }}>
                <TextUI size={14} weight="bold" color={c.textPrimary}>
                  {f.titleAr}
                </TextUI>
                <TextUI size={11} color={c.textSecondary} numberOfLines={1}>
                  {f.titleEn}
                </TextUI>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 6. Daily Ayah Inspiration Card */}
      <View
        style={{
          borderRadius: 18,
          backgroundColor: c.surface,
          padding: 18,
          borderWidth: 1,
          borderColor: c.border,
          marginBottom: 10
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Feather name="sun" size={15} color={TOKENS.colors.secondary} />
          <TextUI size={13} weight="bold" color={TOKENS.colors.secondary}>
            {t('آية وتأمل اليوم', 'Ayah of the Day')}
          </TextUI>
        </View>

        <TextUI quran size={18} weight="bold" color={TOKENS.colors.primaryDark} style={{ lineHeight: 32, textAlign: 'center', marginVertical: 8 }}>
          ﴿ إِنَّ ٱلَّذِينَ ءَامَنُوا۟ وَعَمِلُوا۟ ٱلصَّـٰلِحَـٰتِ سَيَجْعَلُ لَهُمُ ٱلرَّحْمَـٰنُ وُدًّۭا ﴾
        </TextUI>

        <TextUI size={12} color={c.textSecondary} style={{ textAlign: 'center', marginTop: 4 }}>
          {t('سورة مريم • الآية ٩٦', 'Surah Maryam • Verse 96')}
        </TextUI>
      </View>
    </ScrollView>
  );
};
