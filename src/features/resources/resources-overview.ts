import { buildLawDatabaseEntries } from '@/features/laws/law-database';
import {
  MEMORY_GALLERY_CATEGORIES,
  type MemoryGalleryCategory,
  type MemoryGalleryImage,
} from '@/lib/memory-gallery';
import type { QuestionSummary, SubjectId } from '@/lib/types';
import { subjects } from '@/question-bank/catalog';

const GALLERY_PREVIEW_COUNT = 3;
const TOP_LAW_COUNT = 5;

export type MemoryGalleryPreview = Pick<
  MemoryGalleryImage,
  'id' | 'title' | 'category' | 'thumbnailSrc' | 'width' | 'height'
>;

/** Build-time figures for the resources hub, small enough that the hub never ships the bank. */
export interface ResourcesOverview {
  questions: {
    total: number;
    subjectCount: number;
    firstYear: number | null;
    lastYear: number | null;
  };
  /** Newest year with questions for each subject, in catalog order; null when none yet. */
  latestYears: { subject: SubjectId; year: number | null }[];
  gallery: {
    total: number;
    categories: { id: MemoryGalleryCategory; count: number }[];
    latest: MemoryGalleryPreview[];
  };
  laws: {
    total: number;
    top: { name: string; questionCount: number }[];
  };
}

export function buildResourcesOverview(
  questions: readonly QuestionSummary[],
  galleryItems: readonly MemoryGalleryImage[],
): ResourcesOverview {
  const years = questions.map((question) => question.year);
  const published = galleryItems
    .filter((item) => !item.archivedAt)
    .sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id),
    );
  const laws = buildLawDatabaseEntries(questions);

  return {
    questions: {
      total: questions.length,
      subjectCount: new Set(questions.map((question) => question.subject)).size,
      firstYear: years.length ? Math.min(...years) : null,
      lastYear: years.length ? Math.max(...years) : null,
    },
    latestYears: subjects.map((subject) => {
      const subjectYears = questions
        .filter((question) => question.subject === subject.id)
        .map((question) => question.year);
      return {
        subject: subject.id,
        year: subjectYears.length ? Math.max(...subjectYears) : null,
      };
    }),
    gallery: {
      total: published.length,
      categories: MEMORY_GALLERY_CATEGORIES.map((category) => ({
        id: category.id,
        count: published.filter((item) => item.category === category.id).length,
      })),
      latest: published
        .slice(0, GALLERY_PREVIEW_COUNT)
        .map(({ id, title, category, thumbnailSrc, width, height }) => ({
          id,
          title,
          category,
          thumbnailSrc,
          width,
          height,
        })),
    },
    laws: {
      total: laws.length,
      top: laws
        .slice(0, TOP_LAW_COUNT)
        .map(({ name, questionCount }) => ({ name, questionCount })),
    },
  };
}
