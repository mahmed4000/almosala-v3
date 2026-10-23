import React, { useMemo, useState } from 'react';
import { FlatList, Modal, TextInput, TouchableOpacity, View, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { Header } from '../components/common/Header';
import { TextUI } from '../components/common/TextUI';
import { TOKENS, makeShadow } from '../constants/tokens';
import { QURAN_JUZ_INDEX } from '../data/quranIndex';
import { QURAN_RECITERS } from '../services/quranParser';
import { toArabicNumber, toStandardNumber } from '../services/prayerCalculation';

const QURAN_DATA: any[] = require('../../assets/quran_complete_114.json');
const RECITER_STORAGE_KEY = 'quran.selected-reciter';
type IndexMode = 'surah' | 'juz';
type JumpType = 'page' | 'surah' | 'juz';

const normalizeSearch = (value: string) => value
  .toLowerCase()
  .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
  .replace(/[أإآ]/g, 'ا')
  .trim();

export const QuranIndexScreen: React.FC = () => {
  const { goBack, navigate, theme, themeMode, t, setSelectedSurah, readingBookmark, triggerHaptic } = useApp();
  const [indexMode, setIndexMode] = useState<IndexMode>('surah');
  const [search, setSearch] = useState('');
  const [selectedReciter, setSelectedReciter] = useState(QURAN_RECITERS[0].id);
  const [reciterModalVisible, setReciterModalVisible] = useState(false);
  const [jumpModalVisible, setJumpModalVisible] = useState(false);
  const [jumpType, setJumpType] = useState<JumpType>('page');
  const [jumpValue, setJumpValue] = useState('');
  const c = theme;
  const query = normalizeSearch(search);

  React.useEffect(() => {
    AsyncStorage.getItem(RECITER_STORAGE_KEY).then((saved) => {
      if (saved && QURAN_RECITERS.some((reciter) => reciter.id === saved)) setSelectedReciter(saved);
    }).catch(() => {});
  }, []);

  const selectedReciterData = QURAN_RECITERS.find((item) => item.id === selectedReciter) || QURAN_RECITERS[0];
  const filteredSurahs = useMemo(() => QURAN_DATA.filter((surah) => {
    if (!query) return true;
    return normalizeSearch(`${surah.nameAr} ${surah.nameEn}`).includes(query) || surah.id.toString() === toStandardNumber(query);
  }), [query]);
  const filteredJuz = useMemo(() => QURAN_JUZ_INDEX.filter((item) => {
    if (!query) return true;
    return toStandardNumber(query) === String(item.juz) || normalizeSearch(item.startSurahNameAr).includes(query);
  }), [query]);

  const openReader = (surah: any, mode: 'page' | 'surah' = 'page', page = surah.mushafPageStart || 1, autoPlay = false) => {
    setSelectedSurah(surah);
    navigate('quran_reader', { readingMode: mode, startPage: page, startSurahId: surah.id, reciterId: selectedReciter, autoPlay });
  };
  const openPage = (page: number) => {
    const safePage = Math.max(1, Math.min(604, page));
    const pageSectionSurah = QURAN_DATA.find((item) => item.pageMetadata?.some((meta: any) => Number(meta.pageNum) === safePage)) || QURAN_DATA[0];
    setSelectedSurah(pageSectionSurah);
    navigate('quran_reader', { readingMode: 'page', startPage: safePage, startSurahId: pageSectionSurah.id, reciterId: selectedReciter });
  };
  const executeJump = () => {
    const value = Number(toStandardNumber(jumpValue));
    if (!Number.isFinite(value) || value < 1) return;
    if (jumpType === 'page') openPage(Math.min(604, value));
    if (jumpType === 'surah') {
      const surah = QURAN_DATA.find((item) => item.id === Math.min(114, value));
      if (surah) openReader(surah, 'page');
    }
    if (jumpType === 'juz') {
      const juz = QURAN_JUZ_INDEX.find((item) => item.juz === Math.min(30, value));
      const surah = QURAN_DATA.find((item) => item.id === juz?.startSurahId) || QURAN_DATA[0];
      if (juz) openReader(surah, 'page', juz.startPage);
    }
    setJumpModalVisible(false);
    setJumpValue('');
  };
  const chooseReciter = (reciterId: string) => {
    setSelectedReciter(reciterId);
    AsyncStorage.setItem(RECITER_STORAGE_KEY, reciterId).catch(() => {});
  };

  const renderSurah = ({ item }: { item: any }) => (
    <View style={{ flex: 1, marginHorizontal: 4, marginVertical: 3, minWidth: 0 }}>
      <TouchableOpacity activeOpacity={0.75} onPress={() => openReader(item, 'page')} style={{ minHeight: 47, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <TextUI size={13} weight="medium" color={c.textPrimary}>{toArabicNumber(item.id)}</TextUI>
        <TextUI quran size={20} color={c.textPrimary} numberOfLines={1} style={{ flexShrink: 1 }}> {item.nameAr}</TextUI>
      </TouchableOpacity>
    </View>
  );

  const renderJuz = ({ item }: { item: (typeof QURAN_JUZ_INDEX)[number] }) => (
    <View style={{ flex: 1, margin: 4 }}>
      <TouchableOpacity activeOpacity={0.75} onPress={() => {
        const surah = QURAN_DATA.find((entry) => entry.id === item.startSurahId) || QURAN_DATA[0];
        openReader(surah, 'page', item.startPage);
      }} style={{ minHeight: 47, borderRadius: 9, padding: 7, justifyContent: 'center', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, flexDirection: 'row', gap: 8 }}>
        <TextUI size={13} color={c.textPrimary}>{toArabicNumber(item.juz)}</TextUI>
        <TextUI quran size={19} color={c.textPrimary}>الجزء {toArabicNumber(item.juz)}</TextUI>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 48 : (Platform.OS === 'web' ? 46 : 14), paddingBottom: 11, backgroundColor: TOKENS.colors.primaryDark }}>
        <TouchableOpacity 
          onPress={goBack} 
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)' }}
        >
          <Feather name="arrow-right" size={17} color={c.surface} />
          <TextUI size={13} weight="bold" color={c.surface}>رجوع</TextUI>
        </TouchableOpacity>
        <TextUI size={17} weight="bold" color={c.surface}>{t('القرآن', 'Quran')}</TextUI>
        <TouchableOpacity onPress={() => setReciterModalVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 90, justifyContent: 'flex-end' }}><Feather name="mic" size={17} color={c.surface} /><TextUI size={11} color={c.surface} numberOfLines={1}>{selectedReciterData.nameAr}</TextUI></TouchableOpacity>
      </View>
      <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.bgSecondary, borderRadius: 28, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1, borderColor: c.border, gap: 8, marginBottom: 9 }}>
          <Feather name="search" size={18} color={c.textSecondary} />
          <TextInput placeholder={indexMode === 'surah' ? 'ابحث باسم السورة أو رقمها...' : 'ابحث برقم الجزء أو اسم السورة...'} placeholderTextColor={c.textSecondary} value={search} onChangeText={setSearch} style={{ flex: 1, color: c.textPrimary, textAlign: 'right', fontSize: 14 }} />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Feather name="x" size={16} color={c.textSecondary} /></TouchableOpacity> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 5, marginBottom: 8, padding: 3, borderRadius: 12, backgroundColor: c.bgSecondary }}>
          {([{ id: 'surah', label: 'السور', icon: 'book-open' }, { id: 'juz', label: 'الأجزاء', icon: 'grid' }] as const).map((tab) => {
            const active = indexMode === tab.id;
            return <TouchableOpacity key={tab.id} onPress={() => { setIndexMode(tab.id); setSearch(''); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 8, borderRadius: 9, backgroundColor: active ? c.surface : 'transparent', borderWidth: active ? 1 : 0, borderColor: c.border }}>
              <TextUI quran size={19} weight={active ? 'bold' : 'regular'} color={active ? c.textPrimary : c.textSecondary}>{tab.label}</TextUI>
            </TouchableOpacity>;
          })}
          <TouchableOpacity onPress={() => { setJumpType('page'); setJumpModalVisible(true); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 9 }}><Feather name="corner-up-right" size={15} color={c.textSecondary} /><TextUI quran size={18} weight="bold" color={c.textPrimary}>اذهب</TextUI></TouchableOpacity>
        </View>
        {readingBookmark && !search ? <TouchableOpacity activeOpacity={0.88} onPress={() => {
          const surah = QURAN_DATA.find((item) => item.id === readingBookmark.surahId) || QURAN_DATA[0];
          setSelectedSurah(surah);
          navigate('quran_reader', { readingMode: 'page', startPage: readingBookmark.page, startSurahId: readingBookmark.surahId, startAyah: readingBookmark.ayah, reciterId: selectedReciter });
        }} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: themeMode === 'light' ? TOKENS.colors.secondaryLight : '#382E28', borderRadius: 13, padding: 11, marginBottom: 5, borderWidth: 1, borderColor: TOKENS.colors.secondary }}>
          <Feather name="bookmark" size={16} color={TOKENS.colors.primaryDark} /><View style={{ flex: 1, marginStart: 9 }}><TextUI size={11} color={TOKENS.colors.primaryDark}>متابعة القراءة</TextUI><TextUI size={13} weight="bold" color={TOKENS.colors.primaryDark}>{readingBookmark.surahName} • آية {toArabicNumber(readingBookmark.ayah)} • ص {toArabicNumber(readingBookmark.page)}</TextUI></View><Feather name="chevron-left" size={17} color={TOKENS.colors.primaryDark} />
        </TouchableOpacity> : null}
      </View>
      <FlatList
        key={indexMode}
        data={indexMode === 'surah' ? filteredSurahs : filteredJuz}
        numColumns={2}
        keyExtractor={(item: any) => `${indexMode}-${indexMode === 'surah' ? item.id : item.juz}`}
        renderItem={indexMode === 'surah' ? renderSurah : renderJuz}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        maxToRenderPerBatch={24}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<TextUI size={12} color={c.textSecondary} style={{ marginHorizontal: 4, marginBottom: 5 }}>{toArabicNumber(indexMode === 'surah' ? filteredSurahs.length : filteredJuz.length)} {indexMode === 'surah' ? 'سورة' : 'جزء'}</TextUI>}
        ListEmptyComponent={<View style={{ alignItems: 'center', paddingVertical: 44 }}><Feather name="search" size={28} color={c.textSecondary} /><TextUI size={14} weight="bold" color={c.textPrimary} style={{ marginTop: 10 }}>لا توجد نتائج</TextUI></View>}
      />
      <Modal visible={reciterModalVisible} transparent animationType="slide" onRequestClose={() => setReciterModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18, maxHeight: '91%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><View><TextUI size={19} weight="bold" color={c.textPrimary}>القرّاء</TextUI><TextUI size={11} color={c.textSecondary} style={{ marginTop: 3 }}>اختر القارئ الذي تفضله للتلاوة</TextUI></View><TouchableOpacity onPress={() => setReciterModalVisible(false)}><Feather name="x" size={21} color={c.textPrimary} /></TouchableOpacity></View>
            <FlatList data={QURAN_RECITERS} keyExtractor={(item) => item.id} renderItem={({ item }) => {
              const active = item.id === selectedReciter;
              return <TouchableOpacity onPress={() => { triggerHaptic('light'); chooseReciter(item.id); setReciterModalVisible(false); }} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 3, borderBottomWidth: 1, borderColor: c.border, backgroundColor: active ? c.bgSecondary : 'transparent' }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: themeMode === 'light' ? TOKENS.colors.primaryLight : '#382A20', alignItems: 'center', justifyContent: 'center', borderWidth: active ? 2 : 0, borderColor: TOKENS.colors.primary }}><TextUI quran size={24} weight="bold" color={TOKENS.colors.primaryDark}>{item.nameAr.slice(0, 1)}</TextUI></View>
                <View style={{ flex: 1 }}><TextUI size={16} weight="bold" color={c.textPrimary}>{item.nameAr}</TextUI><TextUI size={11} color={c.textSecondary} style={{ marginTop: 3 }}>{item.nameEn} • رواية حفص</TextUI></View>
                {active ? <Feather name="check-circle" size={21} color={TOKENS.colors.success} /> : <Feather name="chevron-left" size={18} color={c.textSecondary} />}
              </TouchableOpacity>;
            }} />
          </View>
        </View>
      </Modal>
      <Modal visible={jumpModalVisible} transparent animationType="fade" onRequestClose={() => setJumpModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 22 }}><View style={{ backgroundColor: c.surface, borderRadius: 20, padding: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><TextUI size={17} weight="bold" color={c.textPrimary}>انتقال مباشر</TextUI><TouchableOpacity onPress={() => setJumpModalVisible(false)}><Feather name="x" size={20} color={c.textPrimary} /></TouchableOpacity></View>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>{([{ id: 'page', label: 'صفحة' }, { id: 'surah', label: 'سورة' }, { id: 'juz', label: 'جزء' }] as const).map((item) => <TouchableOpacity key={item.id} onPress={() => { setJumpType(item.id); setJumpValue(''); }} style={{ flex: 1, alignItems: 'center', padding: 9, borderRadius: 10, backgroundColor: jumpType === item.id ? TOKENS.colors.primary : c.bgSecondary }}><TextUI size={12} weight="bold" color={jumpType === item.id ? '#FFFFFF' : c.textPrimary}>{item.label}</TextUI></TouchableOpacity>)}</View>
          <TextInput value={jumpValue} onChangeText={setJumpValue} keyboardType="number-pad" placeholder={jumpType === 'page' ? '١ – ٦٠٤' : jumpType === 'surah' ? '١ – ١١٤' : '١ – ٣٠'} placeholderTextColor={c.textSecondary} style={{ marginTop: 14, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: c.border, color: c.textPrimary, textAlign: 'center', fontSize: 18 }} />
          <TouchableOpacity onPress={executeJump} disabled={!jumpValue.trim()} style={{ marginTop: 12, backgroundColor: TOKENS.colors.primary, padding: 13, borderRadius: 12, alignItems: 'center', opacity: jumpValue.trim() ? 1 : 0.45 }}><TextUI size={13} weight="bold" color="#FFFFFF">اذهب إلى الموضع</TextUI></TouchableOpacity>
        </View></View>
      </Modal>
    </View>
  );
};
