import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appendImageFiles,
  AttachmentGallery,
  ImageAttachments,
} from '@/components/image-attachments';

const image = {
  id: 'image-1',
  name: '詳解示意圖.png',
  type: 'image/png',
  dataUrl:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
};

afterEach(cleanup);

describe('AttachmentGallery', () => {
  it('opens an in-page lightbox instead of an image hyperlink', () => {
    render(<AttachmentGallery images={[image]} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: '放大圖片 詳解示意圖.png' }),
    );
    expect(
      screen.getByRole('dialog', { name: '放大檢視 詳解示意圖.png' }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole('button', { name: '關閉放大圖片' })[1],
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ImageAttachments', () => {
  it('opens an attached note image without removing it', () => {
    const onChange = vi.fn();
    render(<ImageAttachments images={[image]} onChange={onChange} />);

    fireEvent.click(
      screen.getByRole('button', { name: '放大圖片 詳解示意圖.png' }),
    );

    expect(
      screen.getByRole('dialog', { name: '放大檢視 詳解示意圖.png' }),
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('appendImageFiles', () => {
  it('turns a pasted image file into a note attachment', async () => {
    const result = await appendImageFiles(
      [],
      [new File(['image'], 'clipboard.png', { type: 'image/png' })],
    );

    expect(result.error).toBe('');
    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toMatchObject({
      name: 'clipboard.png',
      type: 'image/png',
    });
    expect(result.images[0].dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('keeps the four-image limit when pasting', async () => {
    const images = Array.from({ length: 4 }, (_, index) => ({
      id: `image-${index}`,
      name: `${index}.png`,
      type: 'image/png',
      dataUrl: 'data:image/png;base64,dGVzdA==',
    }));
    const result = await appendImageFiles(
      images,
      [new File(['image'], 'extra.png', { type: 'image/png' })],
    );

    expect(result.images).toEqual(images);
    expect(result.error).toContain('最多上傳 4 張');
  });
});
