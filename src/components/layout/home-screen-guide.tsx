import { InfoDialog } from '@/components/ui/ui';
import type { HomeScreenGuideMode } from '@/lib/home-screen';
import styles from './home-screen-guide.module.css';

interface Guide {
  description: string;
  steps: readonly string[];
  note?: string;
}

function inAppGuide(browser: 'Safari' | 'Chrome'): Guide {
  return {
    description: '你現在是在其他 App 裡看這個網頁，這裡不能加入主畫面。',
    steps: [
      '點畫面右上角或右下角的選單，通常是「⋯」。',
      `選擇用 ${browser} 打開。`,
      `在 ${browser} 裡打開網站選單，再點一次「加入主畫面」。`,
    ],
    note: `找不到這個選項時，複製網址貼到 ${browser} 也可以。在這裡寫過的作答紀錄不會跟著過去。`,
  };
}

const guides: Record<HomeScreenGuideMode, Guide> = {
  ios: {
    description: 'iPhone 和 iPad 要從瀏覽器自己加入。',
    // The share sheet covers this dialog, so each step has to be short enough to remember.
    steps: [
      '點「⋯」，再點「分享」。',
      '往下捲動，點「加入主畫面」。',
      '有「打開為網頁 App」就關閉，再點「加入」。',
    ],
    note: '關閉後才看得到現在的作答紀錄。',
  },
  android: {
    description: '請照下面的步驟，從瀏覽器選單加入。',
    steps: [
      '點瀏覽器右上角的選單「⋮」。',
      '點「安裝並建立捷徑」或「加到主畫面」，各瀏覽器的名稱略有不同。',
      '再點「安裝」或「新增」。',
    ],
  },
  'ios-in-app': inAppGuide('Safari'),
  'android-in-app': inAppGuide('Chrome'),
};

export function HomeScreenGuide({
  mode,
  onClose,
}: {
  mode: HomeScreenGuideMode;
  onClose: () => void;
}) {
  const { description, steps, note } = guides[mode];
  return (
    <InfoDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="加入主畫面"
      description={description}
    >
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      {note ? <p className={styles.note}>{note}</p> : null}
    </InfoDialog>
  );
}
