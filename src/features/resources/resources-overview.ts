import { buildLawDatabaseEntries } from '@/features/laws/law-database';
import type { MemoryGalleryImage } from '@/lib/memory-gallery';
import type { QuestionSummary } from '@/lib/types';

const GALLERY_PREVIEW_COUNT = 3;
const TOP_LAW_COUNT = 5;

export type MemoryGalleryPreview = Pick<
  MemoryGalleryImage,
  'id' | 'title' | 'thumbnailSrc' | 'width' | 'height'
>;

/** Build-time figures for the resources hub, small enough that the hub never ships the bank. */
export interface ResourcesOverview {
  questions: {
    total: number;
    subjectCount: number;
    firstYear: number | null;
    lastYear: number | null;
  };
  gallery: {
    total: number;
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
    gallery: {
      total: published.length,
      latest: published
        .slice(0, GALLERY_PREVIEW_COUNT)
        .map(({ id, title, thumbnailSrc, width, height }) => ({
          id,
          title,
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
