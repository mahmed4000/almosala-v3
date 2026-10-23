import React, { useState, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Modal,
  Share,
  TextInput,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { createAudioPlayer } from 'expo-audio';
import { useApp } from '../context/AppContext';
import { TextUI } from '../components/common/TextUI';
import { toArabicNumber } from '../services/prayerCalculation';
import { QURAN_PAGE_INDEX, QURAN_JUZ_INDEX } from '../data/quranIndex';
import {
  parseSurahVerses,
  QuranVerse,
  QURAN_RECITERS,
  getAyahAudioUrl
} from '../services/quranParser';
import {
  AVAILABLE_TAFSIR_EDITIONS,
  TafsirEdition,
  fetchAyahTafsir,
  getSavedTafsirId,
  saveSelectedTafsirId,
  DEFAULT_TAFSIR_ID
} from '../services/tafsirService';
import { TOKENS, makeShadow } from '../constants/tokens';

const QURAN_DATA: any[] = require('../../assets/quran_complete_114.json');
let allQuranVersesCache: QuranVerse[] | null = null;
const getAllQuranVerses = () => {
  if (!allQuranVersesCache) allQuranVersesCache = QURAN_DATA.flatMap((item) => parseSurahVerses(item).verses);
  return allQuranVersesCache;
};
type PlaybackRange = 'page' | 'surah' | 'juz' | 'quran';
interface PlaybackSettings {
  range: PlaybackRange;
  rangeRepeats: number;
  ayahRepeats: number;
  pauseSeconds: number;
  speed: number;
  stopAtRangeEnd: boolean;
}
const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = { range: 'surah', rangeRepeats: 1, ayahRepeats: 1, pauseSeconds: 0, speed: 1, stopAtRangeEnd: true };
const PLAYBACK_SETTINGS_KEY = 'quran.playback-settings.v1';
const AYAH_NOTES_KEY = 'quran.ayah-notes.v1';
const TAFSIR_FONT_SIZE_KEY = 'quran.tafsir-font-size.v1';
type JumpType = 'page' | 'surah' | 'juz';

export const QuranReaderScreen: React.FC = () => {
  const {
    goBack,
    screenParams,
    theme,
    themeMode,
    t,
    selectedSurah,
    setSelectedSurah,
    quranFontSize,
    setQuranFontSize,
    readingBookmark,
    setReadingBookmark,
    triggerHaptic
  } = useApp();

  const c = theme;
  const currentSurah = selectedSurah || QURAN_DATA[0];
  const parsedSurah = parseSurahVerses(currentSurah);
  const initialPage = screenParams?.startPage ||
    (readingBookmark && readingBookmark.surahId === currentSurah.id ? readingBookmark.page : currentSurah.mushafPageStart || 1);

  const [readingMode, setReadingMode] = useState<'page' | 'surah'>(screenParams?.readingMode === 'surah' ? 'surah' : 'page');
  const [activePage, setActivePage] = useState<number>(initialPage);
  const [renderedPages, setRenderedPages] = useState<number[]>(() => {
    const first = Math.max(1, initialPage - 2);
    return Array.from({ length: Math.min(8, 605 - first) }, (_, index) => first + index);
  });
  const [activeAyah, setActiveAyah] = useState<QuranVerse | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [ayahNoteModalVisible, setAyahNoteModalVisible] = useState(false);
  const [ayahNoteText, setAyahNoteText] = useState('');
  const [ayahNotes, setAyahNotes] = useState<Record<string, string>>({});
  const [tafsirModalVisible, setTafsirModalVisible] = useState(false);
  const tafsirEditions = AVAILABLE_TAFSIR_EDITIONS;
  const [selectedTafsirId, setSelectedTafsirId] = useState<number>(DEFAULT_TAFSIR_ID);
  const [tafsirFontSize, setTafsirFontSize] = useState<number>(16);
  const [activeTafsirText, setActiveTafsirText] = useState('');
  const [tafsirLoading, setTafsirLoading] = useState(false);
  const [tafsirError, setTafsirError] = useState('');
  const tafsirRequestRef = useRef(0);
  const [selectedReciter, setSelectedReciter] = useState(screenParams?.reciterId || QURAN_RECITERS[0].id);
  const [reciterModalVisible, setReciterModalVisible] = useState(false);
  const [playbackSettingsVisible, setPlaybackSettingsVisible] = useState(false);
  const [playbackSettings, setPlaybackSettings] = useState<PlaybackSettings>(DEFAULT_PLAYBACK_SETTINGS);
  const [playbackSettingsLoaded, setPlaybackSettingsLoaded] = useState(false);
  const [playingAyahNum, setPlayingAyahNum] = useState<number | null>(null);
  const [playingSurahId, setPlayingSurahId] = useState<number | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [searchWord, setSearchWord] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeedIndex, setScrollSpeedIndex] = useState(1);
  const [readerControlsVisible, setReaderControlsVisible] = useState(false);
  const [jumpModalVisible, setJumpModalVisible] = useState(false);
  const [jumpType, setJumpType] = useState<JumpType>('page');
  const [jumpValue, setJumpValue] = useState('');
  const [tajweedTexts, setTajweedTexts] = useState<Record<string, string>>({});

  const audioPlayerRef = useRef<any>(null);
  const webAudioRef = useRef<any>(null);
  const playbackSequenceRef = useRef<{ verses: QuranVerse[]; startIndex: number; cursor: number; repeatsLeft: number; ayahRepeatsLeft: number; settings: PlaybackSettings } | null>(null);
  const sequenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayHandledRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const maxScrollRef = useRef(0);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const audioProgressWidthRef = useRef(0);
  const pinchStartDistanceRef = useRef(0);
  const pinchStartFontSizeRef = useRef(quranFontSize);
  const lastPinchFontSizeRef = useRef(quranFontSize);
  const pageOffsetsRef = useRef<Record<number, number>>({});
  const pendingScrollPageRef = useRef(initialPage);
  const paginationEndRef = useRef(renderedPages[renderedPages.length - 1] || initialPage);
  const pageAppendPendingRef = useRef(false);
  const scrollSpeeds = [12, 22, 36, 55, 80];
  const quranTextAlign: 'center' = 'center';

  const touchDistance = (touches: any[]) => {
    if (!touches || touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  const handleReaderTouchStart = (event: any) => {
    const distance = touchDistance(event.nativeEvent.touches);
    if (distance > 0) {
      pinchStartDistanceRef.current = distance;
      pinchStartFontSizeRef.current = quranFontSize;
      lastPinchFontSizeRef.current = quranFontSize;
    }
  };
  const handleReaderTouchMove = (event: any) => {
    const distance = touchDistance(event.nativeEvent.touches);
    if (!distance || !pinchStartDistanceRef.current) return;
    const nextSize = Math.max(17, Math.min(48, Math.round(pinchStartFontSizeRef.current * distance / pinchStartDistanceRef.current)));
    if (nextSize !== lastPinchFontSizeRef.current) {
      lastPinchFontSizeRef.current = nextSize;
      setQuranFontSize(nextSize);
    }
  };
  const handleReaderTouchEnd = (event: any) => {
    if ((event.nativeEvent.touches?.length || 0) < 2) pinchStartDistanceRef.current = 0;
  };

  useEffect(() => {
    AsyncStorage.getItem(PLAYBACK_SETTINGS_KEY).then((raw) => {
      if (raw) {
        const saved = JSON.parse(raw);
        setPlaybackSettings({ ...DEFAULT_PLAYBACK_SETTINGS, ...saved });
      }
    }).catch(() => {}).finally(() => setPlaybackSettingsLoaded(true));
  }, []);

  useEffect(() => {
    if (screenParams?.reciterId) return;
    AsyncStorage.getItem('quran.selected-reciter').then((saved) => {
      if (saved && QURAN_RECITERS.some((reciter) => reciter.id === saved)) setSelectedReciter(saved);
    }).catch(() => {});
  }, [screenParams?.reciterId]);

  useEffect(() => {
    AsyncStorage.getItem(AYAH_NOTES_KEY).then((raw) => {
      if (raw) setAyahNotes(JSON.parse(raw));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    getSavedTafsirId().then((savedId) => {
      setSelectedTafsirId(savedId);
    }).catch(() => {});
    AsyncStorage.getItem(TAFSIR_FONT_SIZE_KEY).then((saved) => {
      if (saved) {
        const size = parseInt(saved, 10);
        if (size >= 12 && size <= 26) setTafsirFontSize(size);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const scope = readingMode === 'page' ? `page:${activePage}` : `chapter:${currentSurah.id}`;
    const storageKey = `quran.tajweed.${scope}`;
    let cancelled = false;
    const loadTajweedText = async () => {
      try {
        const cached = await AsyncStorage.getItem(storageKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          if (!cancelled) setTajweedTexts((previous) => ({ ...previous, ...cachedData }));
          return;
        }
        const filter = readingMode === 'page' ? `page_number=${activePage}` : `chapter_number=${currentSurah.id}`;
        const response = await fetch(`https://api.quran.com/api/v4/quran/verses/uthmani_tajweed?${filter}`);
        if (!response.ok) return;
        const payload = await response.json();
        const pageMap: Record<string, string> = {};
        for (const verse of payload?.verses || []) {
          if (verse?.verse_key && verse?.text_uthmani_tajweed) pageMap[verse.verse_key.replace(':', '-')] = verse.text_uthmani_tajweed;
        }
        if (Object.keys(pageMap).length) {
          if (!cancelled) setTajweedTexts((previous) => ({ ...previous, ...pageMap }));
          AsyncStorage.setItem(storageKey, JSON.stringify(pageMap)).catch(() => {});
        }
      } catch {
        // Keep the bundled Uthmani text available when the device is offline.
      }
    };
    loadTajweedText();
    return () => { cancelled = true; };
  }, [activePage, currentSurah.id, readingMode]);

  const updatePlaybackSettings = (patch: Partial<PlaybackSettings>) => {
    setPlaybackSettings((previous) => {
      const next = { ...previous, ...patch };
      return next;
    });
  };

  useEffect(() => {
    if (!playbackSettingsLoaded) return;
    AsyncStorage.setItem(PLAYBACK_SETTINGS_KEY, JSON.stringify(playbackSettings)).catch(() => {});
    if (playbackSequenceRef.current) playbackSequenceRef.current.settings = playbackSettings;
  }, [playbackSettings, playbackSettingsLoaded]);

  const pageItem = QURAN_PAGE_INDEX.find((item) => item.page === activePage) || QURAN_PAGE_INDEX[0];
  const getPageSections = (pageNumber: number) => (QURAN_PAGE_INDEX.find((item) => item.page === pageNumber) || QURAN_PAGE_INDEX[0]).sections.map((section) => {
    const surah = QURAN_DATA.find((item) => item.id === section.surahId) || QURAN_DATA[0];
    return {
      section,
      surah,
      verses: parseSurahVerses(surah).verses.filter((verse) => verse.pageNum === pageNumber)
    };
  });
  const pageSections = getPageSections(activePage);
  const pageVerses = pageSections.flatMap((section) => section.verses);

  // Clean audio on unmount
  useEffect(() => {
    return () => {
      try {
        if (sequenceTimerRef.current) clearTimeout(sequenceTimerRef.current);
        if (audioPlayerRef.current) {
          audioPlayerRef.current.pause();
          audioPlayerRef.current.remove();
        }
        if (webAudioRef.current) {
          webAudioRef.current.pause();
        }
      } catch (e) {}
    };
  }, []);

  const stopAudio = () => {
    try {
      playbackSequenceRef.current = null;
      if (sequenceTimerRef.current) {
        clearTimeout(sequenceTimerRef.current);
        sequenceTimerRef.current = null;
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.remove();
        audioPlayerRef.current = null;
      }
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current = null;
      }
      setPlayingAyahNum(null);
      setPlayingSurahId(null);
      setIsAudioLoading(false);
      setIsAudioPlaying(false);
      setAudioPosition(0);
      setAudioDuration(0);
    } catch (e) {}
  };

  const finishSequenceVerse = (finishedVerse: QuranVerse) => {
    const sequence = playbackSequenceRef.current;
    if (!sequence) return;
    if (sequence.ayahRepeatsLeft > 0) {
      sequence.ayahRepeatsLeft -= 1;
      startSequenceVerse(finishedVerse);
      return;
    }
    if (sequence.cursor < sequence.verses.length - 1) {
      sequence.cursor += 1;
      sequence.ayahRepeatsLeft = sequence.settings.ayahRepeats - 1;
    } else if (sequence.repeatsLeft > 0) {
      sequence.repeatsLeft -= 1;
      sequence.cursor = sequence.startIndex;
      sequence.ayahRepeatsLeft = sequence.settings.ayahRepeats - 1;
    } else if (!sequence.settings.stopAtRangeEnd) {
      const allVerses = getAllQuranVerses();
      const next = allVerses.findIndex((item) => item.surahId === finishedVerse.surahId && item.ayahNumber === finishedVerse.ayahNumber);
      if (next >= 0 && next < allVerses.length - 1) {
        sequence.verses = allVerses;
        sequence.cursor = next + 1;
        sequence.startIndex = sequence.cursor;
        sequence.ayahRepeatsLeft = sequence.settings.ayahRepeats - 1;
      } else {
        playbackSequenceRef.current = null;
        setPlayingAyahNum(null);
        setPlayingSurahId(null);
        setIsAudioPlaying(false);
        return;
      }
    } else {
      playbackSequenceRef.current = null;
      setPlayingAyahNum(null);
      setPlayingSurahId(null);
      setIsAudioPlaying(false);
      return;
    }
    const nextVerse = sequence.verses[sequence.cursor];
    if (!nextVerse) return;
    if (sequence.settings.pauseSeconds > 0) {
      setPlayingAyahNum(null);
      sequenceTimerRef.current = setTimeout(() => startSequenceVerse(nextVerse), sequence.settings.pauseSeconds * 1000);
    } else startSequenceVerse(nextVerse);
  };

  const startSequenceVerse = async (verse: QuranVerse) => {
    const sequence = playbackSequenceRef.current;
    if (!sequence) return;
    try {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.remove();
        audioPlayerRef.current = null;
      }
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current = null;
      }
      setPlayingAyahNum(verse.ayahNumber);
      setPlayingSurahId(verse.surahId);
      setIsAudioLoading(true);
      setAudioPosition(0);
      setAudioDuration(0);
      const url = getAyahAudioUrl(verse.surahId, verse.ayahNumber, selectedReciter);
      const player = createAudioPlayer(url, { updateInterval: 250 });
      audioPlayerRef.current = player;
      player.setPlaybackRate(sequence.settings.speed);
      player.addListener('playbackStatusUpdate', (status: any) => {
        if (audioPlayerRef.current !== player) return;
        setIsAudioLoading(!!status?.isBuffering);
        setIsAudioPlaying(!!status?.playing);
        setAudioPosition(Number(status?.currentTime || 0));
        setAudioDuration(Number(status?.duration || 0));
        if (status?.didJustFinish) {
          player.remove();
          audioPlayerRef.current = null;
          setIsAudioPlaying(false);
          finishSequenceVerse(verse);
        }
      });
      player.play();
    } catch {
      setIsAudioLoading(false);
      if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
        const sound = new Audio(getAyahAudioUrl(verse.surahId, verse.ayahNumber, selectedReciter));
        sound.playbackRate = sequence.settings.speed;
        webAudioRef.current = sound;
        sound.oncanplay = () => setIsAudioLoading(false);
        sound.ontimeupdate = () => { setAudioPosition(sound.currentTime || 0); setAudioDuration(sound.duration || 0); setIsAudioPlaying(!sound.paused); };
        sound.onended = () => {
          if (webAudioRef.current !== sound) return;
          webAudioRef.current = null;
          finishSequenceVerse(verse);
        };
        sound.play().catch(() => { playbackSequenceRef.current = null; setPlayingAyahNum(null); setPlayingSurahId(null); setIsAudioPlaying(false); });
      } else {
        playbackSequenceRef.current = null;
        setPlayingAyahNum(null);
        setPlayingSurahId(null);
        setIsAudioPlaying(false);
      }
    }
  };

  const playAyahAudio = async (verse: QuranVerse) => {
    triggerHaptic('light');
    stopAudio();
    const allVerses = getAllQuranVerses();
    let scopedVerses = allVerses;
    if (playbackSettings.range === 'surah') scopedVerses = allVerses.filter((item) => item.surahId === verse.surahId);
    if (playbackSettings.range === 'page') scopedVerses = allVerses.filter((item) => item.pageNum === verse.pageNum);
    if (playbackSettings.range === 'juz') scopedVerses = allVerses.filter((item) => item.juzNum === verse.juzNum);
    const startIndex = scopedVerses.findIndex((item) => item.surahId === verse.surahId && item.ayahNumber === verse.ayahNumber);
    if (startIndex < 0) return;
    playbackSequenceRef.current = {
      verses: scopedVerses,
      startIndex,
      cursor: startIndex,
      repeatsLeft: playbackSettings.rangeRepeats - 1,
      ayahRepeatsLeft: playbackSettings.ayahRepeats - 1,
      settings: playbackSettings
    };
    startSequenceVerse(verse);
  };

  useEffect(() => {
    if (!screenParams?.autoPlay || autoPlayHandledRef.current) return;
    const firstVerse = parseSurahVerses(currentSurah).verses[0];
    if (firstVerse) {
      autoPlayHandledRef.current = true;
      // The user explicitly requested playback when opening this reader from the Quran index.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      playAyahAudio(firstVerse);
    }
    // This should run once when opening a surah from the play button in the index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenParams?.autoPlay]);

  const handleOpenAyahAction = (verse: QuranVerse) => {
    triggerHaptic('light');
    openAyahTafsir(verse);
  };

  const loadAyahTafsir = async (editionId: number, verse: QuranVerse | null = activeAyah) => {
    if (!verse) return;
    const requestId = ++tafsirRequestRef.current;
    setTafsirLoading(true);
    setTafsirError('');
    setActiveTafsirText('');

    try {
      const text = await fetchAyahTafsir(editionId, verse.surahId, verse.ayahNumber);
      if (requestId === tafsirRequestRef.current) {
        setActiveTafsirText(text);
      }
    } catch (error) {
      if (requestId === tafsirRequestRef.current) {
        setTafsirError(error instanceof Error ? error.message : 'تعذر تحميل التفسير. تحقق من اتصال الإنترنت.');
      }
    } finally {
      if (requestId === tafsirRequestRef.current) {
        setTafsirLoading(false);
      }
    }
  };

  const openAyahTafsir = async (verse: QuranVerse | null = activeAyah) => {
    if (!verse) return;
    setActiveAyah(verse);
    setActionModalVisible(false);
    setTafsirModalVisible(true);
    setTafsirError('');
    await loadAyahTafsir(selectedTafsirId, verse);
  };

  const handleSelectTafsir = (editionId: number) => {
    triggerHaptic('light');
    setSelectedTafsirId(editionId);
    saveSelectedTafsirId(editionId);
    if (activeAyah) {
      loadAyahTafsir(editionId, activeAyah);
    }
  };

  const handleChangeTafsirFontSize = (delta: number) => {
    setTafsirFontSize((prev) => {
      const next = Math.max(13, Math.min(26, prev + delta));
      AsyncStorage.setItem(TAFSIR_FONT_SIZE_KEY, String(next)).catch(() => {});
      return next;
    });
  };

  const handleNavigateAyahTafsir = (direction: 'next' | 'prev') => {
    if (!activeAyah) return;
    const surahVerses = parsedSurah.verses;
    const currentIndex = surahVerses.findIndex((v) => v.ayahNumber === activeAyah.ayahNumber);
    if (currentIndex < 0) return;
    const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex >= 0 && targetIndex < surahVerses.length) {
      triggerHaptic('light');
      const targetVerse = surahVerses[targetIndex];
      setActiveAyah(targetVerse);
      loadAyahTafsir(selectedTafsirId, targetVerse);
    }
  };

  const ayahNoteKey = (verse: QuranVerse | null) => verse ? `${verse.surahId}:${verse.ayahNumber}` : '';
  const saveAyahNote = async () => {
    if (!activeAyah) return;
    const next = { ...ayahNotes };
    const key = ayahNoteKey(activeAyah);
    if (ayahNoteText.trim()) next[key] = ayahNoteText.trim();
    else delete next[key];
    setAyahNotes(next);
    await AsyncStorage.setItem(AYAH_NOTES_KEY, JSON.stringify(next)).catch(() => {});
    setAyahNoteModalVisible(false);
  };

  const toggleReadingBookmark = (verse: QuranVerse) => {
    triggerHaptic('success');
    if (readingBookmark?.surahId === verse.surahId && readingBookmark?.ayah === verse.ayahNumber) {
      setReadingBookmark(null);
    } else {
      const verseSurah = QURAN_DATA.find((item) => item.id === verse.surahId) || currentSurah;
      setReadingBookmark({
        surahId: verse.surahId,
        surahName: `سورة ${verseSurah.nameAr}`,
        ayah: verse.ayahNumber,
        page: verse.pageNum || activePage,
        juz: verse.juzNum || currentSurah.juz || 1,
        date: 'الآن'
      });
    }
    setActionModalVisible(false);
  };

  const handleShareAyah = (verse: QuranVerse, withTafsir = false) => {
    triggerHaptic('light');
    const verseSurah = QURAN_DATA.find((item) => item.id === verse.surahId) || currentSurah;
    const currentEdition = AVAILABLE_TAFSIR_EDITIONS.find((item) => item.id === selectedTafsirId);
    let message = `﴿ ${verse.text} ﴾ [سورة ${verseSurah.nameAr}: الآية ${verse.ayahNumber}]`;
    if (withTafsir && activeTafsirText.trim()) {
      message += `\n\n📖 ${currentEdition?.name || 'التفسير'}:\n${activeTafsirText.trim()}`;
    }
    message += `\n\n— تطبيق رفيق المسلم (Almosala Pro)`;
    Share.share({ message });
    setActionModalVisible(false);
  };

  const handleNextSurah = () => {
    stopAudio();
    triggerHaptic('light');
    const nextId = (currentSurah.id % 114) + 1;
    const next = QURAN_DATA.find((s) => s.id === nextId);
    if (next) {
      setSelectedSurah(next);
      goToPage(next.mushafPageStart || 1);
    }
  };

  const handlePrevSurah = () => {
    stopAudio();
    triggerHaptic('light');
    const prevId = currentSurah.id === 1 ? 114 : currentSurah.id - 1;
    const prev = QURAN_DATA.find((s) => s.id === prevId);
    if (prev) {
      setSelectedSurah(prev);
      goToPage(prev.mushafPageStart || 1);
    }
  };

  const sourceVerses = readingMode === 'page' ? pageVerses : parsedSurah.verses;
  const displayedVerses = sourceVerses.filter((v) => {
    if (!searchWord.trim()) return true;
    return v.text.includes(searchWord.trim()) || v.ayahNumber.toString() === searchWord.trim();
  });

  const movePage = (direction: -1 | 1) => {
    const nextPage = Math.max(1, Math.min(QURAN_PAGE_INDEX.length, activePage + direction));
    const targetPage = QURAN_PAGE_INDEX.find((item) => item.page === nextPage);
    const firstSection = targetPage?.sections[0];
    if (!targetPage || !firstSection) return;
    triggerHaptic('light');
    setActivePage(nextPage);
    const pageOffset = pageOffsetsRef.current[nextPage];
    if (pageOffset != null) scrollViewRef.current?.scrollTo({ y: pageOffset, animated: true });
    else {
      pendingScrollPageRef.current = nextPage;
      const first = Math.max(1, nextPage - 2);
      const pages = Array.from({ length: Math.min(8, 605 - first) }, (_, index) => first + index);
      setRenderedPages(pages);
      paginationEndRef.current = pages[pages.length - 1] || nextPage;
    }
    if (firstSection.surahId !== currentSurah.id) {
      const nextSurah = QURAN_DATA.find((item) => item.id === firstSection.surahId);
      if (nextSurah) setSelectedSurah(nextSurah);
    }
  };

  const goToPage = (targetPage: number) => {
    const safePage = Math.max(1, Math.min(QURAN_PAGE_INDEX.length, targetPage));
    setActivePage(safePage);
    if (!renderedPages.includes(safePage)) {
      pendingScrollPageRef.current = safePage;
      const first = Math.max(1, safePage - 2);
      const pages = Array.from({ length: Math.min(8, 605 - first) }, (_, index) => first + index);
      setRenderedPages(pages);
      paginationEndRef.current = pages[pages.length - 1] || safePage;
    } else {
      const offset = pageOffsetsRef.current[safePage];
      if (offset != null) scrollViewRef.current?.scrollTo({ y: offset, animated: true });
      else pendingScrollPageRef.current = safePage;
    }
  };

  const openJump = (type: JumpType) => {
    setJumpType(type);
    setJumpValue('');
    setJumpModalVisible(true);
  };

  const executeJump = () => {
    const standardValue = jumpValue.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    const value = Number(standardValue);
    if (!Number.isFinite(value) || value < 1) return;
    let targetSurah: any = null;
    let targetPage = activePage;
    if (jumpType === 'page') targetPage = Math.min(604, value);
    if (jumpType === 'surah') {
      targetSurah = QURAN_DATA.find((item) => item.id === Math.min(114, value));
      if (targetSurah) targetPage = targetSurah.mushafPageStart || 1;
    }
    if (jumpType === 'juz') {
      const juz = QURAN_JUZ_INDEX.find((item) => item.juz === Math.min(30, value));
      if (juz) {
        targetPage = juz.startPage;
        targetSurah = QURAN_DATA.find((item) => item.id === juz.startSurahId);
      }
    }
    if (targetSurah) setSelectedSurah(targetSurah);
    goToPage(targetPage);
    setReadingMode('page');
    setJumpModalVisible(false);
  };

  const currentReciterObj = QURAN_RECITERS.find((r) => r.id === selectedReciter) || QURAN_RECITERS[0];

  const speedOptions = [1, 1.25, 1.5, 2];

  const cyclePlaybackSpeed = () => {
    triggerHaptic('light');
    const currentSpeed = playbackSettings.speed || 1;
    const currentIndex = speedOptions.indexOf(currentSpeed);
    const nextSpeed = currentIndex >= 0 && currentIndex < speedOptions.length - 1 ? speedOptions[currentIndex + 1] : speedOptions[0];

    updatePlaybackSettings({ speed: nextSpeed });
    if (audioPlayerRef.current?.setPlaybackRate) {
      try {
        audioPlayerRef.current.setPlaybackRate(nextSpeed);
      } catch (e) {}
    }
    if (webAudioRef.current) {
      try {
        webAudioRef.current.playbackRate = nextSpeed;
      } catch (e) {}
    }
  };

  const skipAyah = (direction: 1 | -1) => {
    triggerHaptic('light');
    const allVerses = getAllQuranVerses();
    const currentAyahNum = playingAyahNum || activeAyah?.ayahNumber || displayedVerses[0]?.ayahNumber || 1;
    const currentSid = playingSurahId || currentSurah.id;

    const currentIndex = allVerses.findIndex((v) => v.surahId === currentSid && v.ayahNumber === currentAyahNum);
    if (currentIndex < 0) return;

    const targetIndex = currentIndex + direction;
    if (targetIndex >= 0 && targetIndex < allVerses.length) {
      const targetVerse = allVerses[targetIndex];
      if (targetVerse.pageNum && targetVerse.pageNum !== activePage) {
        goToPage(targetVerse.pageNum);
      }
      playAyahAudio(targetVerse);
    }
  };

  const toggleAudioPlayback = () => {
    triggerHaptic('light');
    setReaderControlsVisible(true);
    if (isAudioPlaying) {
      audioPlayerRef.current?.pause();
      webAudioRef.current?.pause();
      setIsAudioPlaying(false);
      return;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.play();
      setIsAudioPlaying(true);
      return;
    }
    if (webAudioRef.current) {
      webAudioRef.current.play().catch(() => {});
      setIsAudioPlaying(true);
      return;
    }
    const verse = activeAyah || displayedVerses[0] || pageVerses[0];
    if (verse) playAyahAudio(verse);
  };

  const seekWithinAyah = (seconds: number) => {
    const next = Math.max(0, Math.min(audioDuration || Number.MAX_SAFE_INTEGER, seconds));
    if (audioPlayerRef.current?.seekTo) audioPlayerRef.current.seekTo(next);
    if (webAudioRef.current) webAudioRef.current.currentTime = next;
    setAudioPosition(next);
  };

  const bookmarkCurrentReading = () => {
    const verse = activeAyah || displayedVerses[0] || pageVerses[0];
    if (verse) toggleReadingBookmark(verse);
  };

  useEffect(() => {
    if (!autoScroll) return;
    const timer = setInterval(() => {
      const next = Math.min(maxScrollRef.current, scrollOffsetRef.current + scrollSpeeds[scrollSpeedIndex] / 20);
      scrollOffsetRef.current = next;
      scrollViewRef.current?.scrollTo({ y: next, animated: false });
      if (next >= maxScrollRef.current && maxScrollRef.current > 0) setAutoScroll(false);
    }, 50);
    return () => clearInterval(timer);
  }, [autoScroll, scrollSpeedIndex]);

  const tajweedColor = (rule: string) => {
    if (rule.includes('ham_wasl') || rule.includes('laam_shamsiyah') || rule.includes('silent')) return '#888888';
    if (rule.includes('qalqalah')) return '#3987A6';
    if (rule.includes('ikhfa') || rule.includes('ghunnah') || rule.includes('idgham')) return '#438B63';
    if (rule.includes('iqlab')) return '#D47732';
    if (rule.includes('madda')) return '#C84D3D';
    return c.textPrimary;
  };

  const renderTajweedText = (markup: string, keyPrefix: string) => {
    const cleanMarkup = markup.replace(/<span\s+class=end>.*?<\/span>/g, '');
    const pieces = cleanMarkup.split(/(<tajweed\s+class=[^>]+>.*?<\/tajweed>)/g);
    return pieces.map((piece, index) => {
      const match = piece.match(/^<tajweed\s+class=([^>]+)>(.*?)<\/tajweed>$/);
      if (!piece) return null;
      return <Text key={`${keyPrefix}-tajweed-${index}`} style={{ fontFamily: 'Amiri_400Regular', color: match ? tajweedColor(match[1]) : c.textPrimary }}>{match ? match[2] : piece}</Text>;
    });
  };

  const renderVerse = (verse: QuranVerse) => {
    const isPlaying = playingAyahNum === verse.ayahNumber && playingSurahId === verse.surahId;
    const isMarked = (readingBookmark?.surahId === verse.surahId && readingBookmark?.ayah === verse.ayahNumber) ||
      (Number(screenParams?.startSurahId) === verse.surahId && Number(screenParams?.startAyah) === verse.ayahNumber);
    return (
      <TextUI
        key={`v-${verse.surahId}-${verse.ayahNumber}`}
        quran
        size={quranFontSize}
        onPress={(event) => { event?.stopPropagation?.(); handleOpenAyahAction(verse); }}
        align="center"
        style={{
          textAlign: quranTextAlign,
          backgroundColor: isPlaying
            ? 'rgba(198, 146, 85, 0.35)'
            : isMarked
            ? 'rgba(212, 163, 115, 0.25)'
            : undefined
        }}
      >
        {isMarked ? ' 🔖 ' : ''}
        {tajweedTexts[`${verse.surahId}-${verse.ayahNumber}`]
          ? renderTajweedText(tajweedTexts[`${verse.surahId}-${verse.ayahNumber}`], `v-${verse.surahId}-${verse.ayahNumber}`)
          : verse.text}
        <TextUI
          quran
          size={Math.round(quranFontSize * 0.92)}
          weight="bold"
          color={isPlaying ? TOKENS.colors.primaryDark : TOKENS.colors.primary}
        >
          {` ۝${verse.arabicNumber} `}
        </TextUI>
      </TextUI>
    );
  };

  const renderSurahNameFrame = (surahName: string, topOffset: number) => {
    const ornament = (mirrored: boolean) => (
      <View pointerEvents="none" style={{ position: 'absolute', [mirrored ? 'right' : 'left']: -1 }}>
        <Image
          source={require('../../assets/surah-frame-ornament.png')}
          resizeMode="stretch"
          style={{ width: 48, height: 59, tintColor: c.textSecondary, transform: [{ scaleX: mirrored ? -1 : 1 }] }}
        />
      </View>
    );

    return (
      <View style={{ position: 'relative', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 9, marginTop: topOffset, marginBottom: 9, minHeight: 58, paddingHorizontal: 43, borderWidth: 1.5, borderColor: c.textSecondary, backgroundColor: c.surface }}>
        {ornament(false)}
        <TextUI quran align="center" size={29} weight="bold" color={c.textPrimary} numberOfLines={1} style={{ flex: 1, textAlign: 'center', lineHeight: 48 }}>سُورَةُ {surahName}</TextUI>
        {ornament(true)}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ minHeight: Platform.OS === 'ios' ? 98 : 54, paddingHorizontal: 12, paddingTop: Platform.OS === 'ios' ? 60 : (Platform.OS === 'web' ? 46 : 14), paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.surface, borderBottomWidth: 1, borderColor: c.border }}>
        {/* زر رجوع واضح وكبير بالاسم والأيقونة */}
        <TouchableOpacity 
          onPress={goBack} 
          accessibilityLabel="رجوع" 
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            gap: 5, 
            paddingHorizontal: 12, 
            paddingVertical: 6, 
            borderRadius: 20, 
            backgroundColor: c.bgSecondary,
            borderWidth: 1,
            borderColor: c.border
          }}
        >
          <Feather name="arrow-right" size={17} color={TOKENS.colors.primary} />
          <TextUI size={13} weight="bold" color={TOKENS.colors.primary}>رجوع</TextUI>
        </TouchableOpacity>

        {/* زر تشغيل/إيقاف التلاوة السريع في الهيدر */}
        <TouchableOpacity
          onPress={toggleAudioPlayback}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            backgroundColor: isAudioPlaying ? TOKENS.colors.primary : c.bgSecondary,
            borderWidth: 1,
            borderColor: isAudioPlaying ? TOKENS.colors.primary : c.border
          }}
        >
          {isAudioLoading ? (
            <ActivityIndicator size="small" color={isAudioPlaying ? '#FFFFFF' : TOKENS.colors.primary} />
          ) : (
            <Feather
              name={isAudioPlaying ? 'pause' : 'play'}
              size={14}
              color={isAudioPlaying ? '#FFFFFF' : TOKENS.colors.primary}
            />
          )}
          <TextUI size={12} weight="bold" color={isAudioPlaying ? '#FFFFFF' : c.textPrimary}>
            {isAudioLoading ? 'جارِ التحميل...' : (isAudioPlaying ? 'إيقاف مؤقت' : 'استماع')}
          </TextUI>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setReciterModalVisible(true)} 
          accessibilityRole="button" 
          accessibilityLabel={`تغيير القارئ، الحالي ${currentReciterObj.nameAr}`} 
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ minWidth: 100, maxWidth: 160, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 20, backgroundColor: c.bgSecondary, borderWidth: 1, borderColor: c.border }}
        >
          <Feather name="mic" size={14} color={TOKENS.colors.primary} />
          <TextUI size={11} weight="bold" color={c.textPrimary} numberOfLines={1}>{currentReciterObj.nameAr}</TextUI>
          <Feather name="chevron-down" size={12} color={c.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 8, paddingVertical: 5, backgroundColor: c.bgSecondary, borderBottomWidth: 1, borderColor: c.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity onPress={() => openJump('surah')} style={{ flex: 1.15, alignItems: 'center', paddingHorizontal: 5, paddingVertical: 7, borderRadius: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
            <TextUI quran size={16} weight="bold" color={c.textPrimary} numberOfLines={1}>سورة {currentSurah.nameAr}</TextUI>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openJump('page')} style={{ minWidth: 58, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 6 }}>
            <TextUI quran size={20} weight="bold" color={c.textPrimary}>{toArabicNumber(activePage)}</TextUI>
          </TouchableOpacity>
          {readingMode === 'page' ? <View style={{ flexDirection: 'row', gap: 2 }}>
            <TouchableOpacity accessibilityLabel="الصفحة السابقة" onPress={() => movePage(-1)} disabled={activePage <= 1} style={{ width: 30, height: 34, alignItems: 'center', justifyContent: 'center', opacity: activePage <= 1 ? 0.35 : 1 }}><Feather name="chevron-right" size={20} color={c.textPrimary} /></TouchableOpacity>
            <TouchableOpacity accessibilityLabel="الصفحة التالية" onPress={() => movePage(1)} disabled={activePage >= QURAN_PAGE_INDEX.length} style={{ width: 30, height: 34, alignItems: 'center', justifyContent: 'center', opacity: activePage >= QURAN_PAGE_INDEX.length ? 0.35 : 1 }}><Feather name="chevron-left" size={20} color={c.textPrimary} /></TouchableOpacity>
          </View> : null}
          <TouchableOpacity onPress={() => openJump('juz')} style={{ flex: 1.05, alignItems: 'center', paddingHorizontal: 5, paddingVertical: 7, borderRadius: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
            <TextUI quran size={16} weight="bold" color={c.textPrimary}>الجزء {toArabicNumber(pageItem.juzNumbers[0] || 1)}</TextUI>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={jumpModalVisible} transparent animationType="fade" onRequestClose={() => setJumpModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'center', padding: 22 }}>
          <View style={{ backgroundColor: c.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: c.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><TextUI size={17} weight="bold" color={c.textPrimary}>الانتقال إلى موضع</TextUI><TouchableOpacity onPress={() => setJumpModalVisible(false)}><Feather name="x" size={20} color={c.textPrimary} /></TouchableOpacity></View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>{([{ id: 'surah', label: 'سورة' }, { id: 'juz', label: 'جزء' }, { id: 'page', label: 'صفحة' }] as const).map((item) => <TouchableOpacity key={item.id} onPress={() => { setJumpType(item.id); setJumpValue(''); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9, backgroundColor: jumpType === item.id ? TOKENS.colors.primary : c.bgSecondary }}><TextUI size={12} weight="bold" color={jumpType === item.id ? '#FFFFFF' : c.textPrimary}>{item.label}</TextUI></TouchableOpacity>)}</View>
            {jumpType === 'page' ? <View><TextInput value={jumpValue} onChangeText={setJumpValue} keyboardType="number-pad" placeholder="رقم الصفحة ١ – ٦٠٤" placeholderTextColor={c.textSecondary} style={{ marginTop: 13, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border, color: c.textPrimary, textAlign: 'center', fontSize: 18 }} /><TouchableOpacity onPress={executeJump} disabled={!jumpValue.trim()} style={{ marginTop: 11, backgroundColor: TOKENS.colors.primary, padding: 12, borderRadius: 10, alignItems: 'center', opacity: jumpValue.trim() ? 1 : 0.45 }}><TextUI size={13} weight="bold" color="#FFFFFF">انتقال للصفحة</TextUI></TouchableOpacity></View> : <ScrollView style={{ maxHeight: 420, marginTop: 9 }} keyboardShouldPersistTaps="handled"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{jumpType === 'surah' ? QURAN_DATA.map((surah: any) => <TouchableOpacity key={`surah-${surah.id}`} onPress={() => { setSelectedSurah(surah); goToPage(surah.mushafPageStart || 1); setReadingMode('page'); setJumpModalVisible(false); }} style={{ width: '48%', minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 6, borderRadius: 9, backgroundColor: c.bgSecondary, borderWidth: 1, borderColor: c.border }}><TextUI size={11} color={c.textSecondary}>{toArabicNumber(surah.id)}</TextUI><TextUI quran size={17} color={c.textPrimary} numberOfLines={1}>{surah.nameAr}</TextUI></TouchableOpacity>) : QURAN_JUZ_INDEX.map((juz) => <TouchableOpacity key={`juz-${juz.juz}`} onPress={() => { const target = QURAN_DATA.find((surah: any) => surah.id === juz.startSurahId); if (target) setSelectedSurah(target); goToPage(juz.startPage); setReadingMode('page'); setJumpModalVisible(false); }} style={{ width: '48%', minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 6, borderRadius: 9, backgroundColor: c.bgSecondary, borderWidth: 1, borderColor: c.border }}><TextUI size={11} color={c.textSecondary}>{toArabicNumber(juz.juz)}</TextUI><TextUI quran size={16} color={c.textPrimary}>الجزء {toArabicNumber(juz.juz)}</TextUI></TouchableOpacity>)}</View></ScrollView>}
          </View>
        </View>
      </Modal>

      {/* In-Surah Search Bar */}
      {isSearching && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: c.surface, borderBottomWidth: 1, borderColor: c.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name="search" size={16} color={c.textSecondary} />
            <TextInput
              placeholder={readingMode === 'page' ? 'ابحث عن كلمة أو رقم الآية في الصفحة...' : 'ابحث عن كلمة أو رقم الآية في السورة...'}
              placeholderTextColor={c.textSecondary}
              value={searchWord}
              onChangeText={setSearchWord}
              style={{ flex: 1, color: c.textPrimary, textAlign: 'right', fontSize: 13 }}
            />
            {searchWord ? (
              <TouchableOpacity onPress={() => setSearchWord('')}>
                <Feather name="x" size={16} color={c.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

        <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 3, paddingTop: 0, paddingBottom: (isAudioPlaying || isAudioLoading || playingAyahNum != null || readerControlsVisible) ? 145 : 16, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onTouchStart={handleReaderTouchStart}
        onTouchMove={handleReaderTouchMove}
        onTouchEnd={handleReaderTouchEnd}
        onTouchCancel={handleReaderTouchEnd}
        onStartShouldSetResponderCapture={(event) => event.target === event.currentTarget}
        onResponderRelease={() => setReaderControlsVisible((visible) => !visible)}
        onScroll={(event) => {
          const offset = event.nativeEvent.contentOffset.y;
          scrollOffsetRef.current = offset;
          if (readingMode === 'page') {
            const pageAtOffset = [...renderedPages].reverse().find((page) => (pageOffsetsRef.current[page] ?? Number.POSITIVE_INFINITY) <= offset + 48);
            if (pageAtOffset && pageAtOffset !== activePage) {
              setActivePage(pageAtOffset);
              const pageSection = getPageSections(pageAtOffset)[0];
              if (pageSection && pageSection.surah.id !== currentSurah.id) setSelectedSurah(pageSection.surah);
            }
            if (!pageAppendPendingRef.current && offset + viewportHeightRef.current * 1.8 >= contentHeightRef.current && paginationEndRef.current < QURAN_PAGE_INDEX.length) {
              pageAppendPendingRef.current = true;
              const nextEnd = Math.min(QURAN_PAGE_INDEX.length, paginationEndRef.current + 5);
              const nextPages = Array.from({ length: nextEnd - (renderedPages[0] - 1) }, (_, index) => renderedPages[0] + index);
              paginationEndRef.current = nextEnd;
              setRenderedPages(nextPages);
            }
          }
        }}
        onContentSizeChange={(_width, height) => { contentHeightRef.current = height; maxScrollRef.current = Math.max(0, height - viewportHeightRef.current); pageAppendPendingRef.current = false; }}
        onLayout={(event) => { viewportHeightRef.current = event.nativeEvent.layout.height; maxScrollRef.current = Math.max(0, contentHeightRef.current - viewportHeightRef.current); }}
      >
        {/* Uthmani page text in natural line flow, matching a printed mushaf page. */}
        <View
          onStartShouldSetResponderCapture={(event) => event.target === event.currentTarget}
          onResponderRelease={() => setReaderControlsVisible((visible) => !visible)}
          style={{
            backgroundColor: c.surface,
            paddingHorizontal: 8,
            paddingVertical: 4,
            minHeight: '100%',
            flexGrow: 1
          }}
        >
          {readingMode === 'page' ? renderedPages.map((pageNumber) => {
            const sections = getPageSections(pageNumber);
            return <View
              key={`mushaf-page-${pageNumber}`}
              onLayout={(event) => {
                pageOffsetsRef.current[pageNumber] = event.nativeEvent.layout.y;
                if (pendingScrollPageRef.current === pageNumber) {
                  scrollViewRef.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: false });
                  pendingScrollPageRef.current = 0;
                }
              }}
              style={{ paddingVertical: 5 }}
            >
              {sections.map(({ section, surah, verses }, sectionIndex) => {
                const sectionVerses = verses.filter((verse) => !searchWord.trim() || verse.text.includes(searchWord.trim()) || verse.ayahNumber.toString() === searchWord.trim());
                if (sectionVerses.length === 0) return null;
                return (
                  <View key={`page-${pageNumber}-surah-${surah.id}`}>
                    {section.startAyah === 1 ? (
                      renderSurahNameFrame(surah.nameAr, sectionIndex === 0 ? 10 : 4)
                    ) : sections.length > 1 ? <TextUI size={12} weight="bold" color={TOKENS.colors.primary} style={{ textAlign: 'center', marginBottom: 6 }}>سورة {surah.nameAr}</TextUI> : null}
                    {section.startAyah === 1 && surah.id !== 9 && surah.id !== 1 ? <TextUI quran size={Math.round(quranFontSize * 0.85)} weight="bold" color={TOKENS.colors.primaryDark} style={{ textAlign: 'center', marginBottom: 8 }}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</TextUI> : null}
                    <TextUI quran align="center" size={quranFontSize} color={c.textPrimary} onPress={() => setReaderControlsVisible(true)} style={{ lineHeight: Math.round(quranFontSize * 2.1), textAlign: quranTextAlign }}>{sectionVerses.map(renderVerse)}</TextUI>
                  </View>
                );
              })}
              <View accessibilityLabel={`نهاية الصفحة ${toArabicNumber(pageNumber)}`} style={{ marginTop: 12, marginBottom: 7, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
                <TextUI quran size={24} color={c.textSecondary} style={{ paddingHorizontal: 7 }}>❧</TextUI>
                <View style={{ minWidth: 78, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 2, borderWidth: 1, borderColor: c.border, borderRadius: 22, backgroundColor: c.bgSecondary }}><TextUI quran size={22} weight="bold" color={c.textPrimary}>{toArabicNumber(pageNumber)}</TextUI></View>
                <TextUI quran size={24} color={c.textSecondary} style={{ paddingHorizontal: 7, transform: [{ scaleX: -1 }] }}>❧</TextUI>
                <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
              </View>
            </View>;
          }) : (
            <TextUI quran align="center" size={quranFontSize} color={c.textPrimary} onPress={() => setReaderControlsVisible(true)} style={{ lineHeight: Math.round(quranFontSize * 2.1), textAlign: quranTextAlign }}>{displayedVerses.map(renderVerse)}</TextUI>
          )}
        </View>

        {/* Tafsir / Purpose Summary */}
        {readingMode === 'surah' && currentSurah.tafsir ? (
          <View
            style={{
              backgroundColor: themeMode === 'light' ? TOKENS.colors.primaryLight : '#2A201A',
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: TOKENS.colors.primary,
              marginBottom: 20
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Feather name="book" size={16} color={TOKENS.colors.primaryDark} />
              <TextUI size={14} weight="bold" color={TOKENS.colors.primaryDark}>
                {t('مقاصد وتفسير السورة الميسر', 'Surah Objectives & Tafsir')}
              </TextUI>
            </View>
            <TextUI size={13} color={c.textPrimary} style={{ lineHeight: 22 }}>
              {currentSurah.tafsir}
            </TextUI>
          </View>
        ) : null}

        {/* Next / Prev Surah Navigation */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePrevSurah}
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
              borderColor: c.border
            }}
          >
            <Feather name="arrow-right" size={16} color={c.textPrimary} />
            <TextUI size={13} weight="bold" color={c.textPrimary}>
              السورة السابقة
            </TextUI>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleNextSurah}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: TOKENS.colors.primary,
              paddingVertical: 14,
              borderRadius: 14
            }}
          >
            <TextUI size={13} weight="bold" color="#FFFFFF">
              السورة التالية
            </TextUI>
            <Feather name="arrow-left" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {(isAudioPlaying || isAudioLoading || playingAyahNum != null || readerControlsVisible) ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 14,
            paddingTop: 8,
            paddingBottom: Platform.OS === 'ios' ? 34 : 12,
            backgroundColor: c.surfaceElevated,
            borderTopWidth: 1,
            borderColor: c.border,
            ...makeShadow('0 -6px 20px rgba(0,0,0,0.12)', '#000', 0.12, 8)
          }}
        >
          {/* 1. Interactive Audio Progress Bar */}
          <TouchableOpacity
            activeOpacity={1}
            onLayout={(event) => {
              audioProgressWidthRef.current = event.nativeEvent.layout.width;
            }}
            onPress={(event) => {
              if (audioDuration > 0 && audioProgressWidthRef.current > 0) {
                seekWithinAyah((audioDuration * event.nativeEvent.locationX) / audioProgressWidthRef.current);
              }
            }}
            hitSlop={{ top: 8, bottom: 8 }}
            style={{ height: 12, justifyContent: 'center', marginBottom: 6 }}
          >
            <View style={{ height: 4, borderRadius: 2, backgroundColor: c.border, overflow: 'hidden' }}>
              <View
                style={{
                  height: 4,
                  backgroundColor: TOKENS.colors.primary,
                  width: `${audioDuration ? Math.min(100, (audioPosition / audioDuration) * 100) : 0}%`
                }}
              />
            </View>
          </TouchableOpacity>

          {/* 2. Top Meta Row: Ayah Info, Reciter, and Quick Actions */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
              paddingHorizontal: 2
            }}
          >
            {/* Right: Current Ayah & Reciter */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 12,
                  backgroundColor: c.bgSecondary,
                  borderWidth: 1,
                  borderColor: c.border
                }}
              >
                <TextUI size={11} weight="bold" color={TOKENS.colors.primary}>
                  {playingAyahNum != null
                    ? `الآية ${toArabicNumber(playingAyahNum)}`
                    : `سورة ${currentSurah.nameAr}`}
                </TextUI>
              </View>

              <TouchableOpacity
                onPress={() => setReciterModalVisible(true)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Feather name="mic" size={13} color={c.textSecondary} />
                <TextUI size={11} color={c.textSecondary} numberOfLines={1}>
                  {currentReciterObj.nameAr}
                </TextUI>
              </TouchableOpacity>
            </View>

            {/* Left: Auto-scroll, Bookmark, Stop */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setAutoScroll((on) => !on)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  borderRadius: 10,
                  backgroundColor: autoScroll ? TOKENS.colors.primaryLight : 'transparent'
                }}
              >
                <Feather
                  name="chevrons-down"
                  size={14}
                  color={autoScroll ? TOKENS.colors.primary : c.textSecondary}
                />
                <TextUI
                  size={10.5}
                  weight={autoScroll ? 'bold' : 'regular'}
                  color={autoScroll ? TOKENS.colors.primary : c.textSecondary}
                >
                  تمرير
                </TextUI>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={bookmarkCurrentReading}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={{ padding: 4 }}
              >
                <Feather name="bookmark" size={15} color={TOKENS.colors.secondary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={stopAudio}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: c.bgSecondary,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Feather name="x" size={14} color={c.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 3. Main Player Control Buttons Row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 8
            }}
          >
            {/* Settings Modal Button */}
            <TouchableOpacity
              onPress={() => setPlaybackSettingsVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: c.bgSecondary,
                borderWidth: 1,
                borderColor: c.border
              }}
            >
              <Feather name="sliders" size={18} color={c.textPrimary} />
            </TouchableOpacity>

            {/* Previous Ayah Button */}
            <TouchableOpacity
              onPress={() => skipAyah(-1)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: c.bgSecondary,
                borderWidth: 1,
                borderColor: c.border
              }}
            >
              <Feather name="skip-back" size={20} color={c.textPrimary} />
            </TouchableOpacity>

            {/* Center: Primary Play / Pause Button */}
            <TouchableOpacity
              onPress={toggleAudioPlayback}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: TOKENS.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                ...makeShadow('0 4px 12px rgba(140,94,60,0.35)', TOKENS.colors.primary, 0.35, 6)
              }}
            >
              {isAudioLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather
                  name={isAudioPlaying ? 'pause' : 'play'}
                  size={26}
                  color="#FFFFFF"
                  style={{ marginLeft: isAudioPlaying ? 0 : 2 }}
                />
              )}
            </TouchableOpacity>

            {/* Next Ayah Button */}
            <TouchableOpacity
              onPress={() => skipAyah(1)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: c.bgSecondary,
                borderWidth: 1,
                borderColor: c.border
              }}
            >
              <Feather name="skip-forward" size={20} color={c.textPrimary} />
            </TouchableOpacity>

            {/* Direct Playback Speed Toggle Button (1x, 1.25x, 1.5x, 2x) */}
            <TouchableOpacity
              onPress={cyclePlaybackSpeed}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 10,
                height: 42,
                borderRadius: 21,
                backgroundColor: (playbackSettings.speed && playbackSettings.speed > 1) ? TOKENS.colors.primary : c.bgSecondary,
                borderWidth: 1,
                borderColor: (playbackSettings.speed && playbackSettings.speed > 1) ? TOKENS.colors.primary : c.border
              }}
            >
              <TextUI
                size={12.5}
                weight="bold"
                color={(playbackSettings.speed && playbackSettings.speed > 1) ? '#FFFFFF' : c.textPrimary}
              >
                {`${playbackSettings.speed || 1}×`}
              </TextUI>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <Modal visible={playbackSettingsVisible} animationType="slide" transparent onRequestClose={() => setPlaybackSettingsVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'flex-end' }}>
          <View style={{ maxHeight: '88%', backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}><View><TextUI size={18} weight="bold" color={c.textPrimary}>إعدادات التلاوة</TextUI><TextUI size={11} color={c.textSecondary} style={{ marginTop: 3 }}>اختر النطاق وطريقة التكرار والسرعة</TextUI></View><TouchableOpacity onPress={() => setPlaybackSettingsVisible(false)}><Feather name="x" size={21} color={c.textPrimary} /></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 10 }}>
                <TextUI size={14} weight="bold" color={c.textPrimary}>نطاق التلاوة</TextUI>
                <TextUI size={11} color={c.textSecondary} style={{ marginTop: 3, marginBottom: 11 }}>يبدأ من الآية المحددة ويتابع حتى نهاية النطاق.</TextUI>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {([{ id: 'page', label: 'الصفحة' }, { id: 'surah', label: 'السورة' }, { id: 'juz', label: 'الجزء' }, { id: 'quran', label: 'القرآن كاملًا' }] as const).map((item) => {
                    const active = playbackSettings.range === item.id;
                    return <TouchableOpacity key={item.id} onPress={() => updatePlaybackSettings({ range: item.id })} style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11, backgroundColor: active ? TOKENS.colors.primary : c.bgSecondary }}><TextUI size={12} weight="bold" color={active ? '#FFFFFF' : c.textPrimary}>{item.label}</TextUI></TouchableOpacity>;
                  })}
                </View>
              </View>

              {([
                { key: 'rangeRepeats' as const, label: 'تكرار النطاق', helper: 'عدد مرات تشغيل النطاق بما فيها المرة الأولى' },
                { key: 'ayahRepeats' as const, label: 'تكرار كل آية', helper: 'عدد مرات تشغيل الآية قبل الانتقال' }
              ]).map((item) => <View key={item.key} style={{ backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}><TextUI size={13} weight="bold" color={c.textPrimary}>{item.label}</TextUI><TextUI size={10} color={c.textSecondary} style={{ marginTop: 3 }}>{item.helper}</TextUI></View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><TouchableOpacity onPress={() => updatePlaybackSettings({ [item.key]: Math.max(1, playbackSettings[item.key] - 1) })} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: c.bgSecondary, alignItems: 'center', justifyContent: 'center' }}><Feather name="minus" size={15} color={c.textPrimary} /></TouchableOpacity><TextUI size={13} weight="bold" color={TOKENS.colors.primary}>{toArabicNumber(playbackSettings[item.key])}×</TextUI><TouchableOpacity onPress={() => updatePlaybackSettings({ [item.key]: Math.min(10, playbackSettings[item.key] + 1) })} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: c.bgSecondary, alignItems: 'center', justifyContent: 'center' }}><Feather name="plus" size={15} color={c.textPrimary} /></TouchableOpacity></View>
              </View>)}

              <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 10 }}>
                <TextUI size={13} weight="bold" color={c.textPrimary}>الوقف بين الآيات</TextUI>
                <View style={{ flexDirection: 'row', gap: 7, marginTop: 10 }}>{([0, 2, 5, 10] as const).map((seconds) => <TouchableOpacity key={seconds} onPress={() => updatePlaybackSettings({ pauseSeconds: seconds })} style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: playbackSettings.pauseSeconds === seconds ? TOKENS.colors.primary : c.bgSecondary }}><TextUI size={11} weight="bold" color={playbackSettings.pauseSeconds === seconds ? '#FFFFFF' : c.textPrimary}>{seconds === 0 ? 'بدون' : `${seconds} ث`}</TextUI></TouchableOpacity>)}</View>
              </View>

              <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 10 }}>
                <TextUI size={13} weight="bold" color={c.textPrimary}>سرعة التشغيل</TextUI>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>{([0.75, 1, 1.25, 1.5, 2] as const).map((speed) => <TouchableOpacity key={speed} onPress={() => { updatePlaybackSettings({ speed }); audioPlayerRef.current?.setPlaybackRate(speed); if (webAudioRef.current) webAudioRef.current.playbackRate = speed; }} style={{ minWidth: 52, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10, backgroundColor: playbackSettings.speed === speed ? TOKENS.colors.primary : c.bgSecondary }}><TextUI size={11} weight="bold" color={playbackSettings.speed === speed ? '#FFFFFF' : c.textPrimary}>{speed}×</TextUI></TouchableOpacity>)}</View>
              </View>

              <TouchableOpacity onPress={() => updatePlaybackSettings({ stopAtRangeEnd: !playbackSettings.stopAtRangeEnd })} style={{ backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flex: 1 }}><TextUI size={13} weight="bold" color={c.textPrimary}>التوقف بعد نهاية النطاق</TextUI><TextUI size={10} color={c.textSecondary} style={{ marginTop: 3 }}>أوقف التلاوة عند نهاية الصفحة أو السورة أو الجزء</TextUI></View><View style={{ width: 43, height: 25, borderRadius: 13, backgroundColor: playbackSettings.stopAtRangeEnd ? TOKENS.colors.success : c.border, padding: 3, justifyContent: 'center', alignItems: playbackSettings.stopAtRangeEnd ? 'flex-end' : 'flex-start' }}><View style={{ width: 19, height: 19, borderRadius: 10, backgroundColor: '#FFFFFF' }} /></View></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Ayah Action Sheet Modal */}
      <Modal visible={actionModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: c.bg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <TextUI size={16} weight="bold" color={c.textPrimary}>
                خيارات الآية {toArabicNumber(activeAyah?.ayahNumber || 1)} • سورة {QURAN_DATA.find((item) => item.id === activeAyah?.surahId)?.nameAr || currentSurah.nameAr}
              </TextUI>
              <TouchableOpacity onPress={() => setActionModalVisible(false)}>
                <Feather name="x" size={20} color={c.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Verse text snippet */}
            <View
              style={{
                backgroundColor: c.surface,
                borderRadius: 14,
                padding: 14,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: c.border
              }}
            >
              <TextUI quran size={16} color={c.textPrimary} style={{ textAlign: 'center', lineHeight: 26 }}>
                ﴿ {activeAyah?.text} ﴾
              </TextUI>
            </View>

            {/* Action Buttons */}
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => openAyahTafsir()}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.border }}
              >
                <Feather name="book-open" size={18} color={TOKENS.colors.primary} />
                <TextUI size={14} weight="bold" color={c.textPrimary}>تفسير الآية • اختر من عدة تفاسير</TextUI>
                <Feather name="chevron-left" size={16} color={c.textSecondary} />
              </TouchableOpacity>

              {/* Play Audio */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setActionModalVisible(false);
                  if (activeAyah) playAyahAudio(activeAyah);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: TOKENS.colors.primary,
                  padding: 14,
                  borderRadius: 14
                }}
              >
                <Feather name="play" size={18} color="#FFFFFF" />
                <TextUI size={14} weight="bold" color="#FFFFFF">
                  استمع للآية بصوت {currentReciterObj.nameAr}
                </TextUI>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => { setActionModalVisible(false); setReciterModalVisible(true); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.border }}
              >
                <Feather name="mic" size={18} color={TOKENS.colors.primary} />
                <TextUI size={14} weight="medium" color={c.textPrimary}>تغيير القارئ • الحالي: {currentReciterObj.nameAr}</TextUI>
                <Feather name="chevron-left" size={16} color={c.textSecondary} />
              </TouchableOpacity>

              {/* Set Bookmark */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => activeAyah && toggleReadingBookmark(activeAyah)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: c.surface,
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: c.border
                }}
              >
                <Feather name="bookmark" size={18} color={TOKENS.colors.primary} />
                <TextUI size={14} weight="medium" color={c.textPrimary}>
                  حفظ علامة القراءة عند هذه الآية
                </TextUI>
              </TouchableOpacity>

              {/* Share Card */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => activeAyah && handleShareAyah(activeAyah)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: c.surface,
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: c.border
                }}
              >
                <Feather name="share-2" size={18} color={TOKENS.colors.primary} />
                <TextUI size={14} weight="medium" color={c.textPrimary}>
                  مشاركة الآية الكريمة
                </TextUI>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setAyahNoteText(activeAyah ? ayahNotes[ayahNoteKey(activeAyah)] || '' : '');
                  setActionModalVisible(false);
                  setAyahNoteModalVisible(true);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.border }}
              >
                <Feather name="edit-3" size={18} color={TOKENS.colors.primary} />
                <TextUI size={14} weight="medium" color={c.textPrimary}>{activeAyah && ayahNotes[ayahNoteKey(activeAyah)] ? 'عرض أو تعديل ملاحظتي على الآية' : 'إضافة ملاحظة على الآية'}</TextUI>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={tafsirModalVisible} animationType="slide" transparent onRequestClose={() => setTafsirModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ maxHeight: '90%', backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 18 }}>
            {/* Grab handle */}
            <View style={{ width: 44, height: 4.5, borderRadius: 3, backgroundColor: c.border, alignSelf: 'center', marginBottom: 12 }} />

            {/* Header Title & Controls */}
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ alignItems: 'flex-end', flex: 1 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <Feather name="book-open" size={17} color={TOKENS.colors.primary} />
                  <TextUI size={17} weight="bold" color={c.textPrimary}>تفسير الآية الكريمة</TextUI>
                </View>
                <TextUI size={11} color={c.textSecondary} style={{ marginTop: 2 }}>
                  سورة {QURAN_DATA.find((item) => item.id === activeAyah?.surahId)?.nameAr || currentSurah.nameAr} • الآية {toArabicNumber(Number(activeAyah?.ayahNumber) || 1)} • صفحة {toArabicNumber(activeAyah?.pageNum || activePage)} • جزء {toArabicNumber(activeAyah?.juzNum || currentSurah.juz || 1)}
                </TextUI>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {/* Font Size decrease / increase */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleChangeTafsirFontSize(-1)}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
                  accessibilityLabel="تصغير خط التفسير"
                >
                  <TextUI size={12} weight="bold" color={c.textPrimary}>-A</TextUI>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleChangeTafsirFontSize(1)}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
                  accessibilityLabel="تكبير خط التفسير"
                >
                  <TextUI size={12} weight="bold" color={c.textPrimary}>+A</TextUI>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setTafsirModalVisible(false)}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginLeft: 2 }}
                  accessibilityLabel="إغلاق التفسير"
                >
                  <Feather name="x" size={18} color={c.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Ayah Card */}
            <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: c.border, marginBottom: 10 }}>
              <TextUI quran size={17} color={c.textPrimary} style={{ textAlign: 'center', lineHeight: 29 }}>
                ﴿ {activeAyah?.text} ﴾ {activeAyah?.badge || `۝${toArabicNumber(activeAyah?.ayahNumber || 1)}`}
              </TextUI>

              {/* Action Toolbar */}
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border }}>
                {/* Audio Listen */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => {
                    if (activeAyah) {
                      if (playingAyahNum === activeAyah.ayahNumber && playingSurahId === activeAyah.surahId) {
                        stopAudio();
                      } else {
                        playAyahAudio(activeAyah);
                      }
                    }
                  }}
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor: playingAyahNum === activeAyah?.ayahNumber && playingSurahId === activeAyah?.surahId ? TOKENS.colors.primary : c.bg,
                    borderWidth: 1,
                    borderColor: playingAyahNum === activeAyah?.ayahNumber && playingSurahId === activeAyah?.surahId ? TOKENS.colors.primary : c.border
                  }}
                >
                  <Feather
                    name={playingAyahNum === activeAyah?.ayahNumber && playingSurahId === activeAyah?.surahId ? 'square' : 'volume-2'}
                    size={13}
                    color={playingAyahNum === activeAyah?.ayahNumber && playingSurahId === activeAyah?.surahId ? '#FFFFFF' : TOKENS.colors.primary}
                  />
                  <TextUI
                    size={11}
                    weight="bold"
                    color={playingAyahNum === activeAyah?.ayahNumber && playingSurahId === activeAyah?.surahId ? '#FFFFFF' : c.textPrimary}
                  >
                    {playingAyahNum === activeAyah?.ayahNumber && playingSurahId === activeAyah?.surahId ? 'إيقاف' : 'استماع'}
                  </TextUI>
                </TouchableOpacity>

                {/* Bookmark */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => activeAyah && toggleReadingBookmark(activeAyah)}
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor: (activeAyah && readingBookmark?.surahId === activeAyah.surahId && readingBookmark?.ayah === activeAyah.ayahNumber) ? 'rgba(212, 163, 115, 0.25)' : c.bg,
                    borderWidth: 1,
                    borderColor: (activeAyah && readingBookmark?.surahId === activeAyah.surahId && readingBookmark?.ayah === activeAyah.ayahNumber) ? TOKENS.colors.primary : c.border
                  }}
                >
                  <Feather
                    name="bookmark"
                    size={13}
                    color={(activeAyah && readingBookmark?.surahId === activeAyah.surahId && readingBookmark?.ayah === activeAyah.ayahNumber) ? TOKENS.colors.primaryDark : c.textSecondary}
                  />
                  <TextUI
                    size={11}
                    weight="medium"
                    color={(activeAyah && readingBookmark?.surahId === activeAyah.surahId && readingBookmark?.ayah === activeAyah.ayahNumber) ? TOKENS.colors.primaryDark : c.textPrimary}
                  >
                    {(activeAyah && readingBookmark?.surahId === activeAyah.surahId && readingBookmark?.ayah === activeAyah.ayahNumber) ? 'محفوظة' : 'علامة'}
                  </TextUI>
                </TouchableOpacity>

                {/* Share Ayah & Tafsir */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => activeAyah && handleShareAyah(activeAyah, true)}
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor: c.bg,
                    borderWidth: 1,
                    borderColor: c.border
                  }}
                >
                  <Feather name="share-2" size={13} color={TOKENS.colors.primary} />
                  <TextUI size={11} weight="medium" color={c.textPrimary}>مشاركة</TextUI>
                </TouchableOpacity>

                {/* Note */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => {
                    setAyahNoteText(activeAyah ? ayahNotes[ayahNoteKey(activeAyah)] || '' : '');
                    setAyahNoteModalVisible(true);
                  }}
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor: activeAyah && ayahNotes[ayahNoteKey(activeAyah)] ? 'rgba(74, 158, 107, 0.2)' : c.bg,
                    borderWidth: 1,
                    borderColor: activeAyah && ayahNotes[ayahNoteKey(activeAyah)] ? '#4A9E6B' : c.border
                  }}
                >
                  <Feather
                    name="edit-3"
                    size={13}
                    color={activeAyah && ayahNotes[ayahNoteKey(activeAyah)] ? '#4A9E6B' : c.textSecondary}
                  />
                  <TextUI
                    size={11}
                    weight="medium"
                    color={activeAyah && ayahNotes[ayahNoteKey(activeAyah)] ? '#4A9E6B' : c.textPrimary}
                  >
                    تدبر
                  </TextUI>
                </TouchableOpacity>

                {/* More options button */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => {
                    setTafsirModalVisible(false);
                    setActionModalVisible(true);
                  }}
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 9,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor: c.bg,
                    borderWidth: 1,
                    borderColor: c.border
                  }}
                >
                  <Feather name="more-horizontal" size={13} color={c.textSecondary} />
                  <TextUI size={11} weight="medium" color={c.textSecondary}>المزيد</TextUI>
                </TouchableOpacity>
              </View>
            </View>

            {/* Tafsir Selector Horizontal Bar */}
            <View style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <TextUI size={12} weight="bold" color={c.textSecondary}>اختر كتاب التفسير ({toArabicNumber(tafsirEditions.length)} تفاسير):</TextUI>
                <TextUI size={11} color={TOKENS.colors.primary} weight="bold">
                  {tafsirEditions.find((e) => e.id === selectedTafsirId)?.badge}
                </TextUI>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: 'row-reverse', gap: 8, paddingVertical: 3 }}
              >
                {tafsirEditions.map((edition) => {
                  const selected = edition.id === selectedTafsirId;
                  return (
                    <TouchableOpacity
                      key={edition.id}
                      activeOpacity={0.75}
                      onPress={() => handleSelectTafsir(edition.id)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 12,
                        backgroundColor: selected ? TOKENS.colors.primary : c.surface,
                        borderWidth: 1,
                        borderColor: selected ? TOKENS.colors.primaryDark : c.border,
                        flexDirection: 'row-reverse',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      {selected && <Feather name="check" size={13} color="#FFFFFF" />}
                      <TextUI size={12} weight="bold" color={selected ? '#FFFFFF' : c.textPrimary}>
                        {edition.name}
                      </TextUI>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Selected Book Info */}
            <View style={{ paddingHorizontal: 2, marginBottom: 8, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
              <TextUI size={11} color={c.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>
                المؤلف: {tafsirEditions.find((e) => e.id === selectedTafsirId)?.author}
              </TextUI>
            </View>

            {/* Tafsir Content Body */}
            <ScrollView
              style={{
                minHeight: 140,
                maxHeight: 290,
                backgroundColor: c.surface,
                borderRadius: 14,
                padding: 12,
                borderWidth: 1,
                borderColor: c.border
              }}
              showsVerticalScrollIndicator
            >
              {tafsirLoading ? (
                <View style={{ paddingVertical: 36, alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator color={TOKENS.colors.primary} size="small" />
                  <TextUI size={12} color={c.textSecondary}>جارٍ جلب التفسير من المصدر المعتمد...</TextUI>
                </View>
              ) : tafsirError ? (
                <View style={{ alignItems: 'center', paddingVertical: 24, gap: 10 }}>
                  <Feather name="alert-circle" size={24} color="#D9534F" />
                  <TextUI size={12} color={c.textSecondary} align="center" style={{ lineHeight: 20 }}>
                    {tafsirError}
                  </TextUI>
                  <TouchableOpacity
                    onPress={() => loadAyahTafsir(selectedTafsirId)}
                    style={{ backgroundColor: TOKENS.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}
                  >
                    <TextUI size={12} weight="bold" color="#FFFFFF">إعادة المحاولة</TextUI>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ width: '100%', alignItems: 'stretch' }}>
                  {activeTafsirText.split('\n\n').filter(Boolean).map((paragraph, pIdx) => (
                    <TextUI
                      key={`tafsir-p-${pIdx}`}
                      align="right"
                      size={tafsirFontSize}
                      color={c.textPrimary}
                      style={{
                        width: '100%',
                        alignSelf: 'stretch',
                        lineHeight: Math.round(tafsirFontSize * 1.95),
                        writingDirection: 'rtl',
                        marginBottom: 10
                      }}
                    >
                      {paragraph.trim()}
                    </TextUI>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Ayah Navigation Footer */}
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <TouchableOpacity
                disabled={activeAyah ? activeAyah.ayahNumber <= 1 : true}
                onPress={() => handleNavigateAyahTafsir('prev')}
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  borderRadius: 10,
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: c.border,
                  opacity: (activeAyah ? activeAyah.ayahNumber <= 1 : true) ? 0.35 : 1
                }}
              >
                <Feather name="chevron-right" size={16} color={c.textPrimary} />
                <TextUI size={11} weight="medium" color={c.textPrimary}>الآية السابقة</TextUI>
              </TouchableOpacity>

              <TextUI size={11} color={c.textSecondary}>
                الآية {toArabicNumber(activeAyah?.ayahNumber || 1)} من {toArabicNumber(parsedSurah.verses.length)}
              </TextUI>

              <TouchableOpacity
                disabled={activeAyah ? activeAyah.ayahNumber >= parsedSurah.verses.length : true}
                onPress={() => handleNavigateAyahTafsir('next')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  borderRadius: 10,
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: c.border,
                  opacity: (activeAyah ? activeAyah.ayahNumber >= parsedSurah.verses.length : true) ? 0.35 : 1
                }}
              >
                <Feather name="chevron-left" size={16} color={c.textPrimary} />
                <TextUI size={11} weight="medium" color={c.textPrimary}>الآية التالية</TextUI>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={ayahNoteModalVisible} animationType="fade" transparent onRequestClose={() => setAyahNoteModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 22 }}>
          <View style={{ backgroundColor: c.surface, borderRadius: 20, padding: 18 }}>
            <TextUI size={16} weight="bold" color={c.textPrimary}>ملاحظة على الآية {toArabicNumber(activeAyah?.ayahNumber || 1)}</TextUI>
            <TextInput value={ayahNoteText} onChangeText={setAyahNoteText} placeholder="اكتب فائدة أو تدبرًا أو مرجعًا" placeholderTextColor={c.textSecondary} multiline textAlign="right" style={{ minHeight: 110, marginTop: 14, padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 12, color: c.textPrimary, textAlignVertical: 'top' }} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 18, marginTop: 14 }}>
              <TouchableOpacity onPress={() => setAyahNoteModalVisible(false)}><TextUI size={13} color={c.textSecondary}>إلغاء</TextUI></TouchableOpacity>
              <TouchableOpacity onPress={saveAyahNote}><TextUI size={13} weight="bold" color={TOKENS.colors.primary}>حفظ الملاحظة</TextUI></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reciter Selection Modal */}
      <Modal visible={reciterModalVisible} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: c.bg, borderRadius: 20, padding: 20, maxHeight: '82%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <TextUI size={17} weight="bold" color={c.textPrimary}>
                اختر القارئ
              </TextUI>
              <TouchableOpacity onPress={() => setReciterModalVisible(false)}>
                <Feather name="x" size={20} color={c.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
            {QURAN_RECITERS.map((r) => (
              <TouchableOpacity
                key={r.id}
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic('light');
                  stopAudio();
                  setSelectedReciter(r.id);
                  AsyncStorage.setItem('quran.selected-reciter', r.id).catch(() => {});
                  setReciterModalVisible(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderColor: c.border
                }}
              >
                <View>
                  <TextUI size={14} weight="bold" color={r.id === selectedReciter ? TOKENS.colors.primary : c.textPrimary}>
                    {r.nameAr}
                  </TextUI>
                  <TextUI size={11} color={c.textSecondary}>
                    {r.nameEn}
                  </TextUI>
                </View>
                {r.id === selectedReciter && (
                  <Feather name="check" size={18} color={TOKENS.colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};
