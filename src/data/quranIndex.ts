export interface QuranPageSection {
  surahId: number;
  surahNameAr: string;
  surahNameEn: string;
  startAyah: number;
  endAyah: number;
  juz: number;
}

export interface QuranPageIndexItem {
  page: number;
  juzNumbers: number[];
  sections: QuranPageSection[];
}

export interface QuranJuzIndexItem {
  juz: number;
  startPage: number;
  endPage: number;
  startSurahId: number;
  startSurahNameAr: string;
  startAyah: number;
}

const QURAN_DATA: any[] = require('../../assets/quran_complete_114.json');

export const QURAN_PAGE_INDEX: QuranPageIndexItem[] = (() => {
  const pageMap = new Map<number, QuranPageIndexItem>();

  QURAN_DATA.forEach((surah) => {
    (surah.pageMetadata || []).forEach((meta: any) => {
      const page = Number(meta.pageNum);
      if (!page) return;

      let item = pageMap.get(page);
      if (!item) {
        item = { page, juzNumbers: [], sections: [] };
        pageMap.set(page, item);
      }

      const juz = Number(meta.juz || surah.juz || 1);
      if (!item.juzNumbers.includes(juz)) item.juzNumbers.push(juz);
      if (!item.sections.some((section) => section.surahId === surah.id)) {
        item.sections.push({
          surahId: surah.id,
          surahNameAr: surah.nameAr,
          surahNameEn: surah.nameEn,
          startAyah: Number(meta.startAyah || 1),
          endAyah: Number(meta.endAyah || surah.verses),
          juz
        });
      }
    });
  });

  return Array.from(pageMap.values())
    .map((item) => ({
      ...item,
      juzNumbers: item.juzNumbers.sort((a, b) => a - b),
      sections: item.sections.sort((a, b) => a.surahId - b.surahId)
    }))
    .sort((a, b) => a.page - b.page);
})();

export const QURAN_JUZ_INDEX: QuranJuzIndexItem[] = Array.from({ length: 30 }, (_, index) => {
  const juz = index + 1;
  const pages = QURAN_PAGE_INDEX.filter((item) => item.juzNumbers.includes(juz));
  const firstPage = pages[0];
  const firstSection = firstPage?.sections.find((section) => section.juz === juz) || firstPage?.sections[0];

  return {
    juz,
    startPage: firstPage?.page || 1,
    endPage: pages[pages.length - 1]?.page || firstPage?.page || 1,
    startSurahId: firstSection?.surahId || 1,
    startSurahNameAr: firstSection?.surahNameAr || 'الفاتحة',
    startAyah: firstSection?.startAyah || 1
  };
});
