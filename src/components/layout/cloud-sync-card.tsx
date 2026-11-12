import { Popover } from '@base-ui/react/popover';
import {
  IconAlertTriangle,
  IconChevronDown,
  IconCloud,
  IconCloudCheck,
  IconCloudX,
  IconLoader2,
  IconLogout,
} from '@tabler/icons-react';
import { useId, useRef, useState } from 'react';
import { useCloudSync } from '@/components/cloud-sync-provider';
import { Button } from '@/components/ui/ui';
import { countSavedRecords } from '@/lib/saved-records';
import { useAppState } from '@/state/app-state';
import shellStyles from './app-shell.module.css';
import styles from './cloud-sync-card.module.css';

/** A clause that moves to the next line whole, so a line never breaks inside a word like 同一份. */
function Phrase({ children }: { children: string }) {
  return <span className={styles.phrase}>{children}</span>;
}

/** What signing in carries between devices; the same list before and after signing in. */
function SyncedContents({ label }: { label: string }) {
  const labelId = useId();
  return (
    <div className={styles.section} role="group" aria-labelledby={labelId}>
      <h3 id={labelId} className={styles.label}>
        {label}
      </h3>
      <ul className={styles.list}>
        <li>
          作答紀錄，<Phrase>以及做到一半的每日抽題和模擬考</Phrase>
        </li>
        <li>文字筆記和難題標記</li>
        <li>字級和配色</li>
      </ul>
      <p className={styles.note}>不包含筆記圖片和法規克漏字。</p>
    </div>
  );
}

function RecordLine() {
  const { state } = useAppState();
  const records = countSavedRecords(state);
  if (!records) return <p className={styles.body}>目前還沒有保存的紀錄。</p>;
  return (
    <p className={styles.body}>
      這台裝置有 <span className={styles.count}>{records.toLocaleString('zh-TW')}</span>{' '}
      筆紀錄，<Phrase>目前只存在這個瀏覽器。</Phrase>
    </p>
  );
}

/**
 * The topbar's cloud button. It never leaves for Google or signs out on its own: it opens a
 * card that explains what syncing does, and the card holds 用 Google 登入 or 登出.
 */
export function CloudSyncCard({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const cloud = useCloudSync();
  const [open, setOpen] = useState(defaultOpen);
  // Stays true until the closing card has faded out, so the box under the button never shows beside it.
  const [cardShown, setCardShown] = useState(defaultOpen);
  // The error the card last showed; the box under the button then shows it without reading it out again.
  const [errorReadInCard, setErrorReadInCard] = useState('');
  const triggerId = useId();
  const popupRef = useRef<HTMLDivElement>(null);
  if (errorReadInCard && errorReadInCard !== cloud.error) setErrorReadInCard('');
  if (cloud.status === 'disabled') return null;

  const user = cloud.user;
  const syncing = cloud.status === 'syncing';
  const pending = cloud.status === 'pending';
  const failed = cloud.status === 'error';
  const name = user?.displayName || '已登入';
  const statusText = syncing ? '同步中' : pending ? '作答進度待同步' : cloud.progressConflicts.length ? '作答進度衝突' : failed ? '同步失敗' : '已同步';
  const triggerLabel = user
    ? `${name}，${statusText}`
    : syncing
      ? '登入中'
      : '跨裝置同步';
  const changeOpen = (next: boolean) => {
    if (next) setCardShown(true);
    else setErrorReadInCard(cloud.error);
    setOpen(next);
  };
  const close = () => changeOpen(false);

  return (
    <div className={shellStyles.cloudSignIn}>
      <Popover.Root
        open={open}
        onOpenChange={changeOpen}
        onOpenChangeComplete={(next) => {
          if (!next) setCardShown(false);
        }}
        triggerId={triggerId}
      >
        <Popover.Trigger
          id={triggerId}
          className={shellStyles.cloudAccountButton}
          aria-label={triggerLabel}
        >
          {syncing ? (
            <IconLoader2 size={16} stroke={2} aria-hidden="true" />
          ) : !user || pending ? (
            <IconCloud size={16} stroke={2} aria-hidden="true" />
          ) : failed ? (
            <IconCloudX size={16} stroke={2} aria-hidden="true" />
          ) : (
            <IconCloudCheck size={16} stroke={2} aria-hidden="true" />
          )}
          <span>
            {user ? (syncing ? '同步中' : name) : syncing ? '登入中' : '跨裝置同步'}
          </span>
          <IconChevronDown size={14} stroke={2} aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            className={styles.positioner}
            side="bottom"
            align="end"
            sideOffset={8}
            collisionPadding={16}
          >
            {/* The card itself takes focus, so its title and description are read first. */}
            <Popover.Popup ref={popupRef} className={styles.card} initialFocus={popupRef}>
              <Popover.Title className={styles.title}>跨裝置同步</Popover.Title>
              {user ? (
                <>
                  <div className={styles.account}>
                    <p className={styles.accountName}>{name}</p>
                    {user.email ? (
                      <p className={styles.accountEmail}>{user.email}</p>
                    ) : null}
                  </div>
                  <div
                    className={styles.status}
                    data-failed={failed || undefined}
                    role={failed ? 'alert' : undefined}
                  >
                    {syncing ? (
                      <IconLoader2 size={16} stroke={2} aria-hidden="true" />
                    ) : failed ? (
                      <IconAlertTriangle size={16} stroke={2} aria-hidden="true" />
                    ) : pending ? (
                      <IconCloud size={16} stroke={2} aria-hidden="true" />
                    ) : (
                      <IconCloudCheck size={16} stroke={2} aria-hidden="true" />
                    )}
                    <p>
                      {statusText}
                      {/* The provider keeps an old error after a later good sync; only a failure shows it. */}
                      {failed && cloud.error ? (
                        <span className={styles.statusError}>{cloud.error}</span>
                      ) : null}
                    </p>
                  </div>
                  <p className={styles.note}>作答進度先保存在本機，有變更時約每分鐘同步。換裝置前請按「立即同步」並等待完成。</p>
                  <div className={styles.actions}>
                    <Button fullWidth disabled={syncing || cloud.progressConflicts.length > 0} onClick={cloud.syncProgressNow}>
                      立即同步作答進度
                    </Button>
                  </div>
                  {cloud.progressConflicts.map((conflict) => (
                    <div className={styles.section} key={conflict.id}>
                      <p className={styles.body}>
                        {conflict.id === 'practice' ? '每日抽題練習' : conflict.id}在本機與雲端都有不同進度，請選擇保留哪一份：
                      </p>
                      <p className={styles.note}>本機：{new Date(conflict.localUpdatedAt).toLocaleString('zh-TW')}；雲端：{new Date(conflict.remoteUpdatedAt).toLocaleString('zh-TW')}。選擇後另一份進度會被取代。</p>
                      <div className={styles.actions}>
                        <Button fullWidth onClick={() => cloud.resolveProgressConflict(conflict.id, 'local')}>保留本機進度</Button>
                        <Button fullWidth onClick={() => cloud.resolveProgressConflict(conflict.id, 'remote')}>保留雲端進度</Button>
                      </div>
                    </div>
                  ))}
                  <SyncedContents label="同步的內容" />
                  <div className={styles.section}>
                    <p className={styles.body}>
                      登出後，這台裝置的紀錄仍會留在這個瀏覽器，
                      <Phrase>只是不再和其他裝置同步。</Phrase>
                    </p>
                    <div className={styles.actions}>
                      <Button
                        fullWidth
                        onClick={() => {
                          void cloud.signOut();
                          close();
                        }}
                      >
                        <IconLogout size={16} stroke={2} aria-hidden="true" />
                        登出
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Popover.Description className={styles.lead}>
                    用 Google 帳號登入，<Phrase>手機、平板和電腦看到同一份紀錄。</Phrase>
                  </Popover.Description>
                  <RecordLine />
                  <SyncedContents label="登入後會同步" />
                  <div className={styles.section}>
                    <p className={styles.body}>
                      不登入也能照常練習，<Phrase>紀錄會留在這個瀏覽器。</Phrase>
                    </p>
                    {cloud.error ? (
                      <p className={styles.error} role="alert">
                        {cloud.error}
                      </p>
                    ) : null}
                    <div className={styles.actions}>
                      <Button
                        variant="primary"
                        fullWidth
                        disabled={syncing}
                        onClick={() => void cloud.signIn()}
                      >
                        {syncing ? (
                          <>
                            <IconLoader2 size={16} stroke={2} aria-hidden="true" />
                            登入中
                          </>
                        ) : (
                          '用 Google 登入'
                        )}
                      </Button>
                      <Button variant="ghost" fullWidth onClick={close}>
                        先留在本機
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      {/* A sign-in started elsewhere (投稿, 問題回報) reports here while the card is shut. */}
      {!user && cloud.error && !cardShown ? (
        <span
          className={shellStyles.cloudError}
          role={cloud.error === errorReadInCard ? undefined : 'alert'}
        >
          {cloud.error}
        </span>
      ) : null}
    </div>
  );
}
