import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { IconLock, IconPhoto, IconUpload } from '@tabler/icons-react';
import { Button, ConfirmDialog } from '@/components/ui/ui';
import { MEMORY_GALLERY_CATEGORIES, MEMORY_GALLERY_MAX_FILE_BYTES, MEMORY_GALLERY_MIME_TYPES,
  memoryGalleryCategoryLabel, type MemoryGalleryCategory, type MemoryGalleryImage } from '@/lib/memory-gallery';
import styles from './memory-gallery-admin-page.module.css';

async function requestGallery(method: string, key: string, body: unknown) {
  const response = await fetch('/api/admin/memory-gallery', {
    method, headers: { 'Content-Type': 'application/json', 'X-Author-Key': key }, body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({ error: '伺服器未回傳有效資料，請確認使用本機開發網站。' })) as { item?: MemoryGalleryImage; error?: string };
  if (!response.ok) throw new Error(result.error ?? '圖庫操作失敗，請重試。');
  return result;
}

function fileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('圖片讀取失敗。'));
    reader.onerror = () => reject(new Error('圖片讀取失敗，請重新選取。'));
    reader.readAsDataURL(file);
  });
}

export function MemoryGalleryAdminPage({ initialItems, editingAvailable }: { initialItems: MemoryGalleryImage[]; editingAvailable: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [key, setKey] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<MemoryGalleryCategory>('law');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [notice, setNotice] = useState<{ error: boolean; text: string }>();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  function clearForm() {
    setEditingId(undefined); setTitle(''); setDescription(''); setFile(null); setPreview('');
    if (fileInput.current) fileInput.current.value = '';
  }

  async function unlock(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(undefined);
    try {
      const response = await fetch('/api/admin/verify-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key.trim() }) });
      const result = await response.json().catch(() => ({ error: '請使用本機開發網站進入管理。' })) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? '驗證失敗。');
      setKey(key.trim()); setAuthorized(true);
    } catch (error) { setNotice({ error: true, text: error instanceof Error ? error.message : '驗證失敗。' }); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setNotice(undefined);
    if (!editingId && !file) { setNotice({ error: true, text: '請先選擇圖片。' }); return; }
    if (file && (!MEMORY_GALLERY_MIME_TYPES.includes(file.type as typeof MEMORY_GALLERY_MIME_TYPES[number]) || file.size > MEMORY_GALLERY_MAX_FILE_BYTES)) {
      setNotice({ error: true, text: '請選擇 8 MB 以內的 PNG、JPEG 或 WebP 圖片。' }); return;
    }
    setBusy(true);
    try {
      const result = await requestGallery(editingId ? 'PATCH' : 'POST', key,
        { title, description, category, ...(editingId ? { id: editingId } : { dataUrl: await fileDataUrl(file!) }) });
      if (!result.item) throw new Error('伺服器未回傳圖片資料，請重新整理檢查。');
      const item = result.item;
      setItems(current => editingId ? current.map(existing => existing.id === item.id ? item : existing) : [item, ...current]);
      clearForm();
      setNotice({ error: false, text: '已寫入本機圖庫；請將圖片及索引一起 commit／push，正式網站才會更新。' });
    } catch (error) { setNotice({ error: true, text: error instanceof Error ? error.message : '儲存失敗。' }); }
    finally { setBusy(false); }
  }

  async function archive(item: MemoryGalleryImage) {
    setBusy(true); setNotice(undefined);
    try {
      await requestGallery('DELETE', key, { id: item.id });
      setItems(current => current.filter(existing => existing.id !== item.id));
      if (editingId === item.id) clearForm();
      setNotice({ error: false, text: '圖片已從本機圖庫下架，原圖及索引仍保留以便還原。commit／push 後會更新正式網站。' });
    } catch (error) { setNotice({ error: true, text: error instanceof Error ? error.message : '下架失敗。' }); }
    finally { setBusy(false); }
  }

  return <section className={styles.page} aria-label="速記圖庫管理">
    <header className={styles.heading}><div><span>AUTHOR ADMIN</span><h2><IconPhoto size={26} aria-hidden="true" />速記圖庫管理</h2>
      <p>僅管理者能上傳、修改分類及下架圖片；發布後所有使用者皆可瀏覽。</p></div>
      <Button role="link" render={<Link href="/resources/memory-gallery" />}>查看速記圖庫</Button></header>
    <aside className={styles.instructions}>
      <strong>本機上傳，隨網站部署發布</strong>
      <p>在專案設定 AUTHOR_EDIT_KEY 並執行 npm run dev，再從本頁上傳。圖片與索引會存入專案，完成後一起 commit／push。</p>
      <p>不需要新增雲端圖片儲存服務；請只上傳你有權公開分享的圖片。金鑰不會存入瀏覽器或圖片索引。</p>
      {!editingAvailable ? <p role="status">目前不是可編輯的本機開發環境。請在電腦開啟 http://localhost:3000/admin/memory-gallery 管理圖片；正式網站僅供瀏覽。</p> : null}
    </aside>
    {notice ? <p className={styles.notice} data-error={notice.error || undefined} role={notice.error ? 'alert' : 'status'}>{notice.text}</p> : null}
    {editingAvailable && !authorized ? <form onSubmit={unlock} className={styles.form} aria-label="驗證圖庫管理者">
      <label htmlFor="gallery-key">管理者金鑰（AUTHOR_EDIT_KEY）</label>
      <input id="gallery-key" type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} required />
      <Button type="submit" variant="primary" disabled={busy || !key.trim()}><IconLock size={17} aria-hidden="true" />{busy ? '驗證中…' : '進入圖庫管理'}</Button>
    </form> : null}
    {editingAvailable && authorized ? <>
      <div className={styles.toolbar}><strong>管理者已解鎖</strong><Button disabled={busy} onClick={() => { setAuthorized(false); setKey(''); clearForm(); setNotice(undefined); }}>鎖定後台</Button></div>
      <form className={styles.form} onSubmit={submit} aria-label={editingId ? '修改速記圖片' : '上傳速記圖片'}>
        <h3>{editingId ? '修改圖片資料' : '上傳新圖片'}</h3>
        <fieldset disabled={busy}>
          <label htmlFor="gallery-category">分類</label><select id="gallery-category" value={category} onChange={event => setCategory(event.target.value as MemoryGalleryCategory)}>
            {MEMORY_GALLERY_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <label htmlFor="gallery-title">圖片標題</label><input id="gallery-title" value={title} maxLength={100} required onChange={event => setTitle(event.target.value)} />
          <label htmlFor="gallery-description">圖片說明（選填）</label><textarea id="gallery-description" value={description} maxLength={1000} rows={3} onChange={event => setDescription(event.target.value)} />
          {!editingId ? <><label htmlFor="gallery-file">整理圖片（PNG／JPEG／WebP，最多 8 MB）</label>
            <input ref={fileInput} id="gallery-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
              const selected = event.target.files?.[0] ?? null;
              if (selected && (!MEMORY_GALLERY_MIME_TYPES.includes(selected.type as typeof MEMORY_GALLERY_MIME_TYPES[number]) || selected.size > MEMORY_GALLERY_MAX_FILE_BYTES)) {
                setNotice({ error: true, text: '請選擇 8 MB 以內的 PNG、JPEG 或 WebP 圖片。' }); setFile(null); setPreview(''); return;
              }
              setFile(selected); setPreview(selected ? URL.createObjectURL(selected) : '');
              if (selected && !title.trim()) setTitle(selected.name.replace(/\.[^.]+$/, '').slice(0, 100));
            }} />
            {preview ? <Image className={styles.preview} src={preview} alt="待上傳圖片預覽" width={600} height={400} unoptimized /> : null}
            <small>系統會校正方向、轉為 WebP 並建立縮圖；超過 12,000 像素的長邊會縮小，保留長圖閱讀細節。</small>
          </> : <small>此處修改標題、說明與分類。若要替換原圖，請另上傳新圖並下架舊圖。</small>}
        </fieldset>
        <div className={styles.actions}><Button type="submit" variant="primary" disabled={busy}><IconUpload size={17} aria-hidden="true" />{busy ? '處理中…' : editingId ? '儲存圖片資料' : '上傳並儲存圖片'}</Button>
          {editingId ? <Button disabled={busy} onClick={clearForm}>取消編輯</Button> : null}</div>
      </form>
      <section className={styles.items} aria-label="已上傳圖片"><header><h3>已上傳圖片</h3><span>{items.length} 張</span></header>
        {items.length ? items.map(item => <article key={item.id}>
          <Image src={item.thumbnailSrc} alt={item.title} width={110} height={90} unoptimized />
          <div><strong>{item.title}</strong><p>{memoryGalleryCategoryLabel(item.category)}</p></div>
          <div className={styles.actions}><Button disabled={busy} aria-label={`編輯 ${item.title}`} onClick={() => { clearForm(); setEditingId(item.id); setTitle(item.title); setDescription(item.description); setCategory(item.category); setNotice(undefined); }}>編輯</Button>
            <ConfirmDialog trigger={<Button variant="danger" disabled={busy} aria-label={`下架 ${item.title}`}>下架</Button>}
              title={`下架「${item.title}」？`} description="只從圖庫清單移除；原圖及索引保留於專案，可透過 Git 或圖庫索引還原。" confirmLabel="確認下架" onConfirm={() => { void archive(item); }} />
          </div>
        </article>) : <p>尚未上傳圖片。</p>}
      </section>
    </> : null}
  </section>;
}
