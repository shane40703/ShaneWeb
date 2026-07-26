import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AttachmentGallery } from '@/components/image-attachments';

const image = {
  id: 'image-1',
  name: '詳解示意圖.png',
  type: 'image/png',
  dataUrl:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
};

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
