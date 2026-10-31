import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Lazy loading is a bundling concern; tests read the editor as soon as it renders.
vi.mock('@/components/rich-text-editor-lazy', async () => ({
  RichTextEditor: (await import('@/components/rich-text-editor')).RichTextEditor,
}));
