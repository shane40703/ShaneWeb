import { expect, test } from '@playwright/test';

test('paper flow, timer, difficult marker, and draft answers stay ungraded', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '選擇練習科目' })).toBeVisible();
  await expect(page.locator('main h2')).toHaveCount(4);
  const homeSubjectIcons = page.locator('[data-size="large"]');
  await expect(homeSubjectIcons).toHaveCount(4);
  expect(
    await homeSubjectIcons.evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).backgroundImage),
    ),
  ).toEqual(['none', 'none', 'none', 'none']);
  await page.getByRole('link', { name: /建築法規與實務/ }).click();
  await expect(page).toHaveURL(/\/papers\?subject=law/);
  const subjectPicker = page.getByRole('group', { name: '科目' });
  await expect(subjectPicker.getByRole('button')).toHaveCount(4);
  await expect(page.getByRole('combobox', { name: '科目' })).toHaveCount(0);
  await subjectPicker.getByRole('button', { name: /建築環境控制/ }).click();
  await expect(page).toHaveURL(/\/papers\?subject=env/);
  await expect(subjectPicker.getByRole('button', { name: /建築環境控制/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await subjectPicker.getByRole('button', { name: /建築法規與實務/ }).click();
  await expect(page).toHaveURL(/\/papers\?subject=law/);
  const yearPicker = page.getByRole('group', { name: '年度' });
  await expect(yearPicker.getByRole('button')).toHaveCount(13);
  await expect(yearPicker.getByRole('button', { name: '114 年' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(yearPicker.getByRole('button', { name: '114', exact: true })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('民國');
  await expect(page.locator('main')).not.toContainText('住宅居室採光有效面積');

  await page.getByRole('link', { name: /開始作答/ }).click();
  await expect(page).toHaveURL(/\/questions\/law\/114\/01/);
  await expect(page.getByText('作答時間')).toBeVisible();
  await expect(page.getByText(/00:00:0\d/)).toBeVisible();
  const quizHeading = page.getByRole('heading', {
    level: 1,
    name: '114 年・建築法規與實務',
  });
  await expect(quizHeading.locator('..').locator('..')).toHaveAttribute(
    'data-compact',
    'true',
  );

  await page.getByRole('button', { name: '標記為難題' }).click();
  await expect(page.getByRole('button', { name: '取消難題標記' })).toBeVisible();
  const quizNavigator = page.getByRole('complementary', { name: '題號導覽' });
  await expect(
    quizNavigator.getByRole('link', {
      name: '前往第 1 題（已標記難題）',
    }),
  ).toHaveAttribute('data-difficult', 'true');
  await expect(quizNavigator.getByText('難題', { exact: true })).toBeVisible();
  await page.getByText('建築基地，為供建築物本身所占之地面及其所應留設之法定空地', { exact: true }).click();
  await expect(page.getByRole('button', { name: '送出答案' })).toHaveCount(0);
  await expect(page.getByText('答案不正確', { exact: true })).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = JSON.parse(localStorage.getItem('shaneweb:state') ?? '{}');
        return state.answers?.['law-114-01'];
      }),
    )
    .toBeUndefined();

  await page.goto('/difficult');
  await expect(page.getByText(/依建築法規定，下列敘述何者錯誤/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '取消難題標記' })).toBeVisible();

  await page.goto('/history');
  await expect(page.getByRole('heading', { name: '還沒有作答紀錄' })).toBeVisible();
});

test('static question paths preserve state and submit a paper result to history', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto(
    '/questions/construction/114/01?mode=random&questions=construction-114-01%2Cconstruction-114-49',
  );
  const navigator = page.getByRole('complementary', { name: '題號導覽' });
  await expect(navigator).toBeVisible();
  await expect(navigator.getByRole('link')).toHaveCount(2);
  await expect
    .poll(() =>
      navigator
        .getByRole('link', { name: '前往第 1 題' })
        .evaluate((element) => getComputedStyle(element).width),
    )
    .toBe('38px');
  await expect(navigator.getByRole('link', { name: '前往第 1 題' })).toHaveAttribute('aria-current', 'step');

  await page.getByText('(3)＞(2)＞(1)', { exact: true }).click();
  await expect(page.getByRole('button', { name: '送出答案' })).toHaveCount(0);
  await expect(navigator.getByRole('link', { name: '前往第 1 題' })).toHaveAttribute('data-answered', 'true');

  await navigator.getByRole('link', { name: '前往第 49 題' }).click();
  await expect(page).toHaveURL(/\/questions\/construction\/114\/49/);
  await expect(page.getByText(/何者可能具有最佳的防水效果/)).toBeVisible();
  await expect(navigator.getByRole('link', { name: '前往第 49 題' })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(page.getByText('答對了', { exact: true })).toHaveCount(0);

  await page.getByText('圖 D', { exact: true }).click();
  await navigator.getByRole('link', { name: '前往第 1 題' }).click();
  await expect(page.getByText('答對了', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);

  await navigator.getByRole('link', { name: '前往第 49 題' }).click();
  await expect(page.getByText('圖 D', { exact: true }).locator('..').getByRole('radio')).toBeChecked();
  await page.getByRole('button', { name: '對答案' }).click();

  await expect(page.getByRole('heading', { name: '本次作答結果' })).toBeVisible();
  await expect(page.getByLabel('本次得分 30.00 分')).toBeVisible();
  await expect(page.getByRole('heading', { name: '逐題作答結果' })).toBeVisible();
  await expect(page.getByText('1 / 2 題答對')).toBeVisible();
  await expect(page.getByText('最佳解').first()).toBeVisible();
  await expect(page.getByRole('link', { name: '詳解與討論' }).last()).toBeVisible();
  await expect(
    page.getByRole('region', { name: '第 49 題使用者筆記' }),
  ).toBeHidden();
  await page.getByText('檢視完整選項與筆記').last().click();
  await expect(
    page.getByRole('region', { name: '第 49 題使用者筆記' }),
  ).toBeVisible();
  await expect(page.getByText('查看題目')).toHaveCount(0);

  await page.getByRole('button', { name: '查看作答紀錄' }).click();
  await expect(page.getByText('50%', { exact: true })).toBeVisible();
  await expect(page.getByText(/^答對/)).toContainText('1');
  await expect(page.getByText(/^答錯/)).toContainText('1');
  await expect(page.getByText('共作答 1 次')).toBeVisible();
  await expect(page.getByRole('heading', { name: '第 1 次' })).toBeVisible();
  await page.getByText('查看完整作答紀錄（2）').click();
  await expect(page.getByRole('region', { name: '完整作答紀錄' })).toBeVisible();
  await expect(page.getByRole('region', { name: '第 1 題使用者筆記' })).toBeHidden();
  await page.getByText('檢視完整選項與筆記').first().click();
  await expect(page.getByRole('region', { name: '第 1 題使用者筆記' })).toBeVisible();
  await page.getByLabel('第 1 題筆記內容').fill('由作答檢討直接建立的筆記。');
  await page.getByRole('button', { name: '儲存筆記' }).first().click();

  await page.getByRole('button', { name: '清除第 1 次紀錄' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: '確認清除' }).click();
  await expect(page.getByRole('heading', { name: '還沒有作答紀錄' })).toBeVisible();
});

test('question content is present in build-time static HTML', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  const response = await request.get('/questions/law/114/01');
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('依建築法規定，下列敘述何者錯誤？');
  expect(html).toContain('建築基地，為供建築物本身所占之地面及其所應留設之法定空地');
});

test('static question files render ordered images and text-only options', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto(
    '/questions/construction/114/01?mode=random&questions=construction-114-01%2Cconstruction-114-49',
  );
  const firstPromptText = page.getByText(/依據下圖中之衝擊韌性試片結果圖/);
  await expect(firstPromptText).toBeVisible();
  const firstPrompt = firstPromptText.locator('..');
  await expect(firstPrompt.locator(':scope > *')).toHaveCount(2);
  expect(await firstPrompt.locator(':scope > *').evaluateAll((nodes) => nodes.map((node) => node.tagName))).toEqual([
    'P',
    'FIGURE',
  ]);
  await expect(page.getByRole('img', { name: '標示為（1）、（2）、（3）的三個衝擊韌性試片斷口照片' })).toBeVisible();
  const options = page.getByRole('radiogroup', { name: '請選擇答案' });
  await expect(options.locator('img')).toHaveCount(0);
  await expect(options.getByText('(3)＞(2)＞(1)', { exact: true })).toBeVisible();
  const [optionBounds, promptBounds, promptTextBounds, promptImageBounds, viewport] = await Promise.all([
    options.boundingBox(),
    firstPrompt.boundingBox(),
    firstPromptText.boundingBox(),
    page
      .getByRole('img', {
        name: '標示為（1）、（2）、（3）的三個衝擊韌性試片斷口照片',
      })
      .boundingBox(),
    Promise.resolve(page.viewportSize()),
  ]);
  expect(optionBounds).not.toBeNull();
  expect(promptBounds).not.toBeNull();
  expect(promptTextBounds).not.toBeNull();
  expect(promptImageBounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(promptImageBounds!.x).toBeGreaterThan(promptTextBounds!.x);
  expect(optionBounds!.y).toBeGreaterThanOrEqual(
    promptBounds!.y + promptBounds!.height,
  );
  expect(optionBounds!.y + optionBounds!.height).toBeLessThanOrEqual(
    viewport!.height,
  );
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await page.getByRole('button', { name: /下一題/ }).click();
  await expect(page.getByText(/何者可能具有最佳的防水效果/)).toBeVisible();
  await expect(page.getByRole('img', { name: '圖 A 至圖 D 四種屋頂設備基礎防水收頭細部剖面圖' })).toBeVisible();
  await expect(options.locator('img')).toHaveCount(0);
  await expect(options.getByText('圖 A', { exact: true })).toBeVisible();
  await expect(options.getByText('圖 D', { exact: true })).toBeVisible();
});

test('official corrected answer accepts every published answer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto(
    '/questions/construction/114/49?mode=random&questions=construction-114-49%2Cconstruction-114-50',
  );
  await page.getByText('圖 B', { exact: true }).click();
  await page.getByRole('button', { name: /下一題/ }).click();
  await page.getByRole('button', { name: '對答案' }).click();
  await expect(page.getByText('1 / 2 題答對')).toBeVisible();
  await expect(page.getByText('你的答案：B')).toBeVisible();
});

test('analysis only shows exam-content distribution', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/analysis?subject=law&year=all');
  await expect(page.getByRole('heading', { name: '選擇分析範圍' })).toBeVisible();
  await expect(page.getByText('總題數 84 題')).toBeVisible();
  await expect(page.getByText('相關法規占比')).toBeVisible();
  await expect(page.getByText(/86 筆法規標註/)).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  const lawAnalysis = page.getByRole('region', { name: '命題分類與對應考古題' });
  await expect(lawAnalysis).toBeVisible();
  await lawAnalysis.getByRole('button', { name: /建築物公共安全檢查簽證及申報辦法/ }).click();
  await expect(lawAnalysis.getByText(/目前範圍共 2 題/)).toBeVisible();
  const focusedQuestionLink = lawAnalysis.locator('a').first();
  await expect(focusedQuestionLink).toHaveAttribute('href', /mode=single/);
  await focusedQuestionLink.click();
  await expect(page).toHaveURL(/mode=single/);
  await expect(
    page.getByRole('complementary', { name: '題號導覽' }).getByRole('link'),
  ).toHaveCount(1);
  await page.goto('/analysis?subject=law&year=all');
  await expect(page.locator('main')).not.toContainText('個人答對率');
  await expect(page.locator('main')).not.toContainText('弱點分析');

  await page
    .getByRole('group', { name: '科目' })
    .getByRole('button', { name: /建築環境控制/ })
    .click();
  await expect(page).toHaveURL(/subject=env/);
  for (const category of ['熱', '空氣', '光', '音', '綠建築', '規範', '水', '設備']) {
    await expect(lawAnalysis.getByRole('button', { name: new RegExp(`^${category}`) })).toBeVisible();
  }
  await lawAnalysis.getByRole('button', { name: /^水/ }).click();
  await expect(lawAnalysis.getByText('水', { exact: true }).last()).toBeVisible();

  await page
    .getByRole('group', { name: '科目' })
    .getByRole('button', { name: /建築構造與施工/ })
    .click();
  for (const category of ['混凝土工程', '鋼構工程', '木構工程', '砌體工程', '裝修工程', '防水工程', '工程管理', '建築材料']) {
    await expect(lawAnalysis.getByRole('button', { name: new RegExp(`^${category}`) })).toBeVisible();
  }
});

test('community selectors and local anonymous interactions work', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/community?question=law-114-01');
  await expect(page.getByRole('group', { name: '科目' })).toBeVisible();
  await expect(page.getByRole('group', { name: '年度' })).toBeVisible();
  await expect(page.getByRole('group', { name: '題號' })).toBeVisible();
  await expect(page.getByText('正確答案')).toBeVisible();
  await expect(
    page.getByText('正確答案').locator('..').getByText('D', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/D・/)).toHaveCount(0);

  await page.getByRole('button', { name: '下一題' }).click();
  await expect(page).toHaveURL(/question=law-114-02/);
  await page.getByRole('button', { name: '上一題' }).click();
  await expect(page).toHaveURL(/question=law-114-01/);

  const content = '先逐項比對建築法中的法定空地定義與主管機關權限。';
  await page.getByLabel('內容').fill(content);
  await page.getByLabel('上傳詳解圖片').setInputFiles({
    name: 'explanation.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.getByRole('button', { name: '匿名送出' }).click();
  const post = page.locator('article').filter({ hasText: content });
  await expect(post).toBeVisible();
  await expect(post.getByRole('img', { name: 'explanation.png' })).toBeVisible();
  await expect(post.getByRole('link', { name: /explanation\.png/ })).toHaveCount(0);
  await post.getByRole('button', { name: '放大圖片 explanation.png' }).click();
  await expect(
    page.getByRole('dialog', { name: '放大檢視 explanation.png' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '關閉放大圖片' }).last().click();
  await post.getByRole('button', { name: /讚 0/ }).click();
  await expect(post.getByRole('button', { name: /讚 1/ })).toBeVisible();
  await expect(post.getByRole('button', { name: /讚 1/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await post.getByRole('button', { name: /讚 1/ }).click();
  await expect(post.getByRole('button', { name: /讚 0/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await post.getByRole('button', { name: '加入我的筆記' }).click();
  await post.getByLabel('回覆這則內容').fill('這個記法很清楚。');
  await expect(post.getByRole('button', { name: '回覆' })).toHaveCSS(
    'white-space',
    'nowrap',
  );
  await post.getByRole('button', { name: '回覆' }).click();
  await expect(post.getByText('這個記法很清楚。')).toBeVisible();
  await post.getByRole('button', { name: '檢舉' }).click();
  await expect(post.getByRole('button', { name: '已檢舉' })).toBeVisible();
  await page.reload();
  await expect(page.getByText(content)).toBeVisible();
});

test('random quiz draws the requested number of unique questions', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/papers?subject=law&year=114');
  await expect(page.getByRole('region', { name: /建立隨機題組/ })).toHaveCount(0);
  await page.goto('/random?subject=law');
  const randomQuiz = page.getByRole('region', { name: /建立隨機題組/ });
  await expect(randomQuiz).toBeVisible();
  await randomQuiz.getByRole('button').filter({ hasText: /^5 題/ }).click();
  await randomQuiz.getByRole('button', { name: '抽出題組' }).click();
  await expect(page).toHaveURL(/mode=random/);
  await expect(page).toHaveURL(/questions=/);
  await expect(page.getByRole('heading', { name: /隨機練習/ })).toBeVisible();
  await expect(page.getByRole('complementary', { name: '題號導覽' }).getByRole('link')).toHaveCount(5);
});

test('notes save and reload from local storage', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/notes?question=law-114-01');
  await expect(page.getByRole('group', { name: '科目' })).toBeVisible();
  await expect(
    page.getByRole('group', { name: '年度' }).getByRole('button', { name: '114 年' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('group', { name: '題號' }).getByRole('button', { name: '第 1 題' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() =>
      page
        .getByRole('group', { name: '題號' })
        .getByRole('button', { name: '第 1 題' })
        .evaluate((element) => getComputedStyle(element).width),
    )
    .toBe('38px');
  const [subjectBounds, yearBounds, questionBounds] = await Promise.all([
    page
      .getByRole('group', { name: '科目' })
      .getByRole('button')
      .evaluateAll((elements) => ({
        top: Math.min(...elements.map((element) => element.getBoundingClientRect().top)),
        bottom: Math.max(...elements.map((element) => element.getBoundingClientRect().bottom)),
      })),
    page
      .getByRole('group', { name: '年度' })
      .getByRole('button')
      .evaluateAll((elements) => ({
        top: Math.min(...elements.map((element) => element.getBoundingClientRect().top)),
        bottom: Math.max(...elements.map((element) => element.getBoundingClientRect().bottom)),
      })),
    page
      .getByRole('group', { name: '題號' })
      .getByRole('button')
      .evaluateAll((elements) => ({
        top: Math.min(...elements.map((element) => element.getBoundingClientRect().top)),
        bottom: Math.max(...elements.map((element) => element.getBoundingClientRect().bottom)),
      })),
  ]);
  const subjectToYear = yearBounds.top - subjectBounds.bottom;
  const yearToQuestion = questionBounds.top - yearBounds.bottom;
  expect(Math.abs(subjectToYear - yearToQuestion)).toBeLessThanOrEqual(1);
  await page.getByLabel('我的筆記').fill('法定空地分割辦法由中央主管建築機關定之。');
  await page.getByLabel('上傳筆記圖片').setInputFiles({
    name: 'note.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.getByRole('button', { name: '儲存筆記' }).click();
  await page.reload();
  await expect(page.getByLabel('我的筆記')).toHaveValue('法定空地分割辦法由中央主管建築機關定之。');
  await expect(page.getByRole('img', { name: 'note.png' })).toBeVisible();
});

test('all retained routes support direct visits and removed routes return 404', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  const routes = [
    '/',
    '/papers?subject=law',
    '/random?subject=law',
    '/questions/law/114/01',
    '/analysis',
    '/community',
    '/notes',
    '/difficult',
    '/history',
  ];

  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);
    await expect(page.locator('main')).toBeVisible();
    await page.reload();
    await expect(page.locator('main')).toBeVisible();
  }

  const settingsResponse = await page.goto('/settings');
  expect(settingsResponse?.status()).toBe(404);
  await expect(page.getByRole('link', { name: '網頁介面設定' })).toHaveCount(0);

  const quizResponse = await page.goto('/quiz');
  expect(quizResponse?.status()).toBe(404);
  const missingQuestionResponse = await page.goto('/questions/law/114/99');
  expect(missingQuestionResponse?.status()).toBe(404);
});

test('mobile drawer links to separate paper and random quiz pages', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/');
  await page.getByRole('button', { name: '開啟選單' }).click();
  await expect(page.getByRole('link', { name: '隨機出題' })).toBeVisible();
  await page.getByRole('link', { name: '隨機出題' }).click();
  await expect(page).toHaveURL(/\/random$/);
  await expect(page.getByRole('heading', { name: '隨機出題' })).toBeVisible();
  await page.getByRole('button', { name: '開啟選單' }).click();
  await page.getByRole('link', { name: '歷屆試題' }).click();
  await expect(page).toHaveURL(/\/papers$/);
  await expect(page.getByRole('heading', { name: '選擇科目與年度' })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test('question images remain responsive on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/questions/construction/114/49');
  await expect(page.getByRole('img', { name: '圖 A 至圖 D 四種屋頂設備基礎防水收頭細部剖面圖' })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: '請選擇答案' }).locator('img')).toHaveCount(0);
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
