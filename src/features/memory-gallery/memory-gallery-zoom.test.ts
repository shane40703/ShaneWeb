import { describe, expect, it } from 'vitest';
import { clampGalleryView, galleryGesture, GALLERY_FIT_VIEW, zoomGalleryView } from './memory-gallery-zoom';

const viewport = { width: 800, height: 600 };
const portrait = { width: 600, height: 900 };

describe('gallery image zoom geometry', () => {
  it('fits portrait and landscape images without allowing blank-space panning', () => {
    expect(clampGalleryView({ scale: 1, x: 100, y: -100 }, viewport, portrait)).toEqual(GALLERY_FIT_VIEW);
    expect(clampGalleryView({ scale: 1, x: 100, y: -100 }, viewport, { width: 1200, height: 400 })).toEqual(GALLERY_FIT_VIEW);
  });
  it('bounds movement to the actual contained image, not the letterboxed viewport', () => {
    expect(clampGalleryView({ scale: 2, x: 2000, y: -2000 }, viewport, portrait)).toEqual({ scale: 2, x: 0, y: -300 });
    expect(clampGalleryView({ scale: 4, x: 2000, y: -2000 }, viewport, portrait)).toEqual({ scale: 4, x: 400, y: -900 });
    expect(clampGalleryView({ scale: 2, x: 2000, y: -2000 }, viewport, { width: 1200, height: 400 }))
      .toEqual({ scale: 2, x: 400, y: 0 });
  });
  it('keeps the image point under the cursor stable while zooming', () => {
    expect(zoomGalleryView({ scale: 3, x: 0, y: 0 }, 4, viewport, portrait, { x: 60, y: 90 }))
      .toEqual({ scale: 4, x: -20, y: -30 });
  });
  it('combines two-finger scaling and midpoint movement without jumping', () => {
    const previous = galleryGesture([{ x: -50, y: 0 }, { x: 50, y: 0 }]);
    const next = galleryGesture([{ x: -80, y: 10 }, { x: 120, y: 10 }]);
    expect(next).toEqual({ centre: { x: 20, y: 10 }, distance: 200 });
    expect(zoomGalleryView({ scale: 2, x: 0, y: 0 }, 2 * next.distance / previous.distance,
      viewport, portrait, previous.centre, next.centre)).toEqual({ scale: 4, x: 20, y: 10 });
  });
  it('uses a single contact for ordinary dragging', () => {
    const previous = galleryGesture([{ x: 0, y: 0 }]);
    const next = galleryGesture([{ x: 35, y: -50 }]);
    expect(next.distance).toBe(0);
    expect(zoomGalleryView({ scale: 3, x: 0, y: 0 }, 3, viewport, portrait, previous.centre, next.centre))
      .toEqual({ scale: 3, x: 35, y: -50 });
  });
  it('limits scaling to 100–800% and resets translation when returning to fit', () => {
    expect(zoomGalleryView(GALLERY_FIT_VIEW, 100, viewport, portrait).scale).toBe(8);
    expect(zoomGalleryView({ scale: 4, x: 350, y: -500 }, .5, viewport, portrait)).toEqual(GALLERY_FIT_VIEW);
    expect(clampGalleryView({ scale: 3, x: 80, y: 80 }, { width: 0, height: 0 }, portrait))
      .toEqual({ scale: 3, x: 0, y: 0 });
  });
});
