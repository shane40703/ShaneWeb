export interface GalleryPoint { x: number; y: number }
export interface GallerySize { width: number; height: number }
export interface GalleryView extends GalleryPoint { scale: number }

export const GALLERY_MIN_ZOOM = 1;
export const GALLERY_MAX_ZOOM = 8;
export const GALLERY_FIT_VIEW: GalleryView = { scale: 1, x: 0, y: 0 };

export function clampGalleryView(view: GalleryView, viewport: GallerySize, image: GallerySize): GalleryView {
  const scale = Math.min(GALLERY_MAX_ZOOM, Math.max(GALLERY_MIN_ZOOM, view.scale));
  const fit = Math.min(viewport.width / image.width, viewport.height / image.height);
  const maxX = Math.max(0, (image.width * fit * scale - viewport.width) / 2);
  const maxY = Math.max(0, (image.height * fit * scale - viewport.height) / 2);
  return { scale, x: maxX ? Math.min(maxX, Math.max(-maxX, view.x)) : 0, y: maxY ? Math.min(maxY, Math.max(-maxY, view.y)) : 0 };
}

// Anchors are relative to the viewport's centre. Keeping the same image point
// under the cursor/finger makes wheel zoom and moving two-finger pinches stable.
export function zoomGalleryView(
  view: GalleryView, scale: number, viewport: GallerySize, image: GallerySize,
  anchor: GalleryPoint = { x: 0, y: 0 }, destination: GalleryPoint = anchor,
): GalleryView {
  const boundedScale = Math.min(GALLERY_MAX_ZOOM, Math.max(GALLERY_MIN_ZOOM, scale));
  const ratio = boundedScale / view.scale;
  return clampGalleryView({ scale: boundedScale,
    x: destination.x - (anchor.x - view.x) * ratio,
    y: destination.y - (anchor.y - view.y) * ratio,
  }, viewport, image);
}

export function galleryGesture(points: GalleryPoint[]) {
  const [first, second = first] = points;
  return { centre: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.hypot(first.x - second.x, first.y - second.y) };
}
