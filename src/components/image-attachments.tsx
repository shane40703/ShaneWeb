import Image from 'next/image';
import { type ChangeEvent, useId, useState } from 'react';
import { IconPhotoPlus, IconTrash } from '@tabler/icons-react';
import type { ImageAttachment } from '@/lib/types';
import styles from './image-attachments.module.css';

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function attachmentId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('圖片讀取失敗'));
    reader.onerror = () => reject(reader.error ?? new Error('圖片讀取失敗'));
    reader.readAsDataURL(file);
  });
}

export function ImageAttachments({
  images,
  onChange,
  label = '上傳圖片',
}: {
  images: ImageAttachment[];
  onChange: (images: ImageAttachment[]) => void;
  label?: string;
}) {
  const inputId = useId();
  const [error, setError] = useState('');

  async function addImages(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (!files.length) return;

    const available = MAX_IMAGES - images.length;
    if (available <= 0) {
      setError(`每題最多上傳 ${MAX_IMAGES} 張圖片。`);
      return;
    }

    const accepted = files
      .filter((file) => file.type.startsWith('image/'))
      .filter((file) => file.size <= MAX_IMAGE_BYTES)
      .slice(0, available);

    if (accepted.length !== files.length) {
      setError(`僅接受 2 MB 以下圖片，每題最多 ${MAX_IMAGES} 張。`);
    } else {
      setError('');
    }

    const nextImages = await Promise.all(
      accepted.map(async (file) => ({
        id: attachmentId(),
        name: file.name,
        type: file.type,
        dataUrl: await readAsDataUrl(file),
      })),
    );
    onChange([...images, ...nextImages]);
  }

  return (
    <div className={styles.attachments}>
      <div className={styles.controls}>
        <label htmlFor={inputId}>
          <IconPhotoPlus size={17} stroke={2} aria-hidden="true" />
          {label}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => void addImages(event)}
        />
        <span>{images.length}/{MAX_IMAGES} 張</span>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {images.length ? (
        <div className={styles.previews}>
          {images.map((image) => (
            <figure key={image.id}>
              <Image
                src={image.dataUrl}
                alt={image.name}
                fill
                unoptimized
                sizes="120px"
              />
              <button
                type="button"
                aria-label={`移除圖片 ${image.name}`}
                onClick={() =>
                  onChange(images.filter((candidate) => candidate.id !== image.id))
                }
              >
                <IconTrash size={15} stroke={2} aria-hidden="true" />
              </button>
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AttachmentGallery({
  images,
}: {
  images: readonly ImageAttachment[];
}) {
  if (!images.length) return null;
  return (
    <div className={styles.gallery}>
      {images.map((image) => (
        <a
          key={image.id}
          href={image.dataUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`開啟圖片 ${image.name}`}
        >
          <Image
            src={image.dataUrl}
            alt={image.name}
            fill
            unoptimized
            sizes="(max-width: 600px) 45vw, 220px"
          />
        </a>
      ))}
    </div>
  );
}
