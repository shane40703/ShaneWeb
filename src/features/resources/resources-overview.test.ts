import { describe, expect, it } from 'vitest';
import type { MemoryGalleryImage } from '@/lib/memory-gallery';
import type { QuestionSummary } from '@/lib/types';
import { buildResourcesOverview } from './resources-overview';

function question(
  id: string,
  subject: QuestionSummary['subject'],
  year: number,
  relatedLaws: string[] = [],
): QuestionSummary {
  return {
    id,
    subject,
    year,
    questionNumber: 1,
    primaryCategory: '分類',
    topic: '分類',
    tags: [],
    relatedLaws,
    text: id,
  };
}

function image(
  id: string,
  category: MemoryGalleryImage['category'],
  createdAt: string,
  archivedAt?: string,
): MemoryGalleryImage {
  return {
    id,
    title: `圖 ${id}`,
    description: '',
    category,
    src: `/memory-gallery/assets/${id}.webp`,
    thumbnailSrc: `/memory-gallery/assets/${id}-thumb.webp`,
    width: 1055,
    height: 1491,
    createdAt,
    updatedAt: createdAt,
    archivedAt,
  };
}

describe('buildResourcesOverview', () => {
  const questions = [
    question('law-112', 'law', 112, ['建築法']),
    question('law-114', 'law', 114, ['建築法', '建築技術規則']),
    question('env-113', 'env', 113),
    question('construction-110', 'construction', 110),
  ];

  it('summarises the question bank', () => {
    const overview = buildResourcesOverview(questions, []);

    expect(overview.questions).toEqual({
      total: 4,
      subjectCount: 3,
      firstYear: 110,
      lastYear: 114,
    });
  });

  it('keeps only published gallery images, newest first', () => {
    const overview = buildResourcesOverview(questions, [
      image('old-law', 'law', '2026-10-01T00:00:00Z'),
      image('new-construction', 'construction', '2026-10-22T00:00:00Z'),
      image('mid-law', 'law', '2026-10-10T00:00:00Z'),
      image('newest-law', 'law', '2026-10-23T00:00:00Z'),
      image('archived', 'env', '2026-10-24T00:00:00Z', '2026-10-25T00:00:00Z'),
    ]);

    expect(overview.gallery.total).toBe(4);
    expect(overview.gallery.latest.map((item) => item.id)).toEqual([
      'newest-law',
      'new-construction',
      'mid-law',
    ]);
    expect(overview.gallery.latest[0]).toEqual({
      id: 'newest-law',
      title: '圖 newest-law',
      thumbnailSrc: '/memory-gallery/assets/newest-law-thumb.webp',
      width: 1055,
      height: 1491,
    });
  });

  it('ranks the most cited laws and reports how many laws exist', () => {
    const overview = buildResourcesOverview(questions, []);

    expect(overview.laws).toEqual({
      total: 2,
      top: [
        { name: '建築法', questionCount: 2 },
        { name: '建築技術規則', questionCount: 1 },
      ],
    });
  });

  it('stays well-formed for an empty bank and gallery', () => {
    expect(buildResourcesOverview([], [])).toEqual({
      questions: { total: 0, subjectCount: 0, firstYear: null, lastYear: null },
      gallery: { total: 0, latest: [] },
      laws: { total: 0, top: [] },
    });
  });
});
