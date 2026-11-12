import { useEffect } from 'react';
import { Toast } from '@base-ui/react/toast';
import { IconSpeakerphone, IconCheck } from '@tabler/icons-react';
import { Button } from '@/components/ui/ui';
import { pushKey, type PushMessage } from '@/lib/push-messages';
import styles from './push-message-toast.module.css';

function Message({ message, onRead, onDelivered }: PushMessageToastProps) {
  const { add, toasts } = Toast.useToastManager();
  useEffect(() => {
    add({ id: pushKey(message), title: message.status === 'test' ? '網站公告（測試）' : '網站公告',
      description: message.message, timeout: 0, priority: 'low' });
  }, [add, message]);
  const toast = toasts.find((item) => item.id === pushKey(message));
  useEffect(() => {
    if (toast && toast.transitionStatus !== 'ending') onDelivered?.();
  }, [toast, onDelivered]);
  return (
    <Toast.Portal>
      <Toast.Viewport className={styles.viewport} aria-label="網站公告">
        {toast ? (
          <Toast.Root toast={toast} className={styles.toast} swipeDirection={[]} data-push-announcement="true">
            <Toast.Content className={styles.content}>
              <div className={styles.heading}>
                <IconSpeakerphone size={20} aria-hidden="true" />
                <Toast.Title className={styles.title} />
              </div>
              <Toast.Description className={styles.message} tabIndex={0} />
              <div className={styles.actions}>
                <Button variant="primary" onClick={onRead}><IconCheck size={17} aria-hidden="true" />已讀</Button>
              </div>
            </Toast.Content>
          </Toast.Root>
        ) : null}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
export interface PushMessageToastProps {
  message: PushMessage;
  onRead: () => void;
  onDelivered?: () => void;
}
/** Its own single-item queue: ordinary transient notifications cannot evict an announcement. */
export function PushMessageToast(props: PushMessageToastProps) {
  return <Toast.Provider key={pushKey(props.message)} limit={1} timeout={0}><Message {...props} /></Toast.Provider>;
}
export function PushTestBadge({ error = false }: { error?: boolean }) {
  return <div className={styles.testBadge} role="status">測試模式{error ? ' · 公告連線失敗，將重試' : ''}</div>;
}
