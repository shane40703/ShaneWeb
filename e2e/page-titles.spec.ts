import { expect, test } from '@playwright/test';

const NOT_FOUND = '找不到頁面｜建築師考試';

/**
 * Every page names its browser tab in the HTML the server sends, so the tab, a bookmark or a
 * shared link reads right before any script runs: the page's name, then the site's.
 */
const titles: Record<string, string> = {
  '/': '建築師大集結｜建築師考試考古題練習平台',
  '/practice': '每日練習｜建築師考試',
  '/practice/quiz': '每日抽題練習｜建築師考試',
  '/practice/law-cloze': '法規克漏字｜建築師考試',
  '/practice/mock-exam': '歷屆試題模擬考｜建築師考試',
  '/exams': '歷屆試題（討論版）｜建築師考試',
  '/exams/law': '營建法規與實務考古題｜建築師考試',
  '/exams/law/114': '114 年營建法規與實務考古題｜建築師考試',
  '/exams/law/114/3': '114 年營建法規與實務考古題第 3 題｜建築師考試',
  '/exams/env/114': '114 年建築環境控制考古題｜建築師考試',
  '/exams/env/114/written-1': '114 年建築環境控制考古題申論第 1 題｜建築師考試',
  '/resources': '歷屆試題資料集成｜建築師考試',
  '/resources/analysis': '考題分析｜建築師考試',
  '/resources/memory-gallery': '速記圖庫・法規｜建築師考試',
  '/resources/memory-gallery/env': '速記圖庫・環控｜建築師考試',
  '/resources/laws': '法規資料庫｜建築師考試',
  '/personal': '我的作答存摺｜建築師考試',
  '/notes': '我的筆記｜建築師考試',
  '/difficult': '難題標記｜建築師考試',
  '/wrong': '常錯題目｜建築師考試',
  '/practice-history': '每日練習履歷｜建築師考試',
  '/history': '歷屆試題作答履歷｜建築師考試',
  '/settings': '設定｜建築師考試',
  '/appearance': '介面配色設定｜建築師考試',
  '/line': 'LINE 社群｜建築師考試',
  '/threads': 'Threads｜建築師考試',
  '/privacy': '隱私權政策｜建築師考試',
  '/licenses': '開源授權｜建築師考試',
  // A mistyped address, and a question the paper does not have.
  '/no-such-page': NOT_FOUND,
  '/exams/law/114/99': NOT_FOUND,
};

test.describe('page titles', () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== 'desktop',
      'the server sends every device the same page',
    ),
  );

  for (const [path, title] of Object.entries(titles)) {
    test(`${path} names its tab before any script runs`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(title === NOT_FOUND ? 404 : 200);
      // The head only: charts may carry <title> tooltips inside their SVG.
      const head = (await response.text()).split('</head>')[0];
      const found = [...head.matchAll(/<title[^>]*>([^<]*)<\/title>/g)].map(
        (match) => match[1],
      );
      expect(found).toEqual([title]);
    });
  }
});
