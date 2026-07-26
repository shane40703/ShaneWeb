import { expect, test, type Page } from '@playwright/test';

async function expectCompactTopbarHeading(page: Page, name: string) {
  const pageHeading = page.getByRole('heading', { level: 1 });

  await expect(pageHeading).toHaveCount(1);
  await expect(pageHeading).toHaveText(name);
  await expect(pageHeading).toHaveCSS('font-size', '16px');
  await expect(page.locator('header h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveCount(0);
}

test('paper flow, timer, difficult marker, and draft answers stay ungraded', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/');
  await expectCompactTopbarHeading(page, '首頁');
  await expect(page.getByRole('region', { name: '選擇練習科目' })).toBeVisible();
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
  await expectCompactTopbarHeading(page, '作答頁');
  await expect(page.getByText('作答時間')).toBeVisible();
  await expect(page.getByText(/00:00:0\d/)).toBeVisible();
  await expect(page.getByRole('heading', {
    level: 1,
    name: '114 年・建築法規與實務',
  })).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: /前往詳解與討論/ }),
  ).toHaveCount(0);

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

  await page.evaluate(() => {
    const state = JSON.parse(
      localStorage.getItem('shaneweb:state') ?? '{}',
    );
    state.difficultQuestionIds = [
      'law-114-01',
      'law-113-01',
      'env-114-01',
    ];
    localStorage.setItem('shaneweb:state', JSON.stringify(state));
  });
  await page.goto('/difficult');
  await expectCompactTopbarHeading(page, '難題標記');
  await expect(
    page.locator('main').getByRole('heading', { level: 2 }),
  ).toHaveText(['建築法規與實務', '建築環境控制']);
  const difficultSubject = page.getByRole('region', {
    name: '建築法規與實務',
  });
  await expect(difficultSubject).toBeVisible();
  await expect(
    difficultSubject.getByRole('heading', {
      level: 2,
      name: '建築法規與實務',
    }),
  ).toBeVisible();
  await expect(difficultSubject.getByText('2 題難題')).toBeVisible();
  await expect(
    difficultSubject.getByRole('heading', { level: 3 }),
  ).toHaveText(['114 年', '113 年']);
  const difficultYear = difficultSubject.getByRole('region', {
    name: '114 年',
  });
  await expect(difficultYear).toBeVisible();
  await expect(
    difficultYear.getByRole('heading', { level: 3, name: '114 年' }),
  ).toBeVisible();
  await expect(difficultYear.getByText('1 題', { exact: true })).toBeVisible();
  await expect(
    difficultYear.getByText(/依建築法規定，下列敘述何者錯誤/).first(),
  ).toBeVisible();
  await difficultYear.getByText('查看完整題目與選項').click();
  const difficultOptions = difficultYear.getByRole('list', {
    name: '第 1 題完整選項',
  });
  await expect(difficultOptions).toBeVisible();
  await expect(difficultOptions.getByRole('listitem')).toHaveCount(4);
  const difficultCorrectOption = difficultOptions.getByRole('listitem', {
    name: /正確選項 D：法定空地之分割要件/,
  });
  await expect(difficultCorrectOption).toHaveAttribute('data-accepted', 'true');
  await expect(difficultCorrectOption).toHaveCSS(
    'background-color',
    'rgb(230, 248, 240)',
  );
  const difficultExplanation = difficultYear.getByRole('region', {
    name: '第 1 題詳解',
  });
  await expect(difficultExplanation).toBeVisible();
  await expect(
    difficultExplanation.getByText('詳解', { exact: true }),
  ).toBeVisible();
  await expect(difficultExplanation).not.toContainText('正確答案');
  await page.reload();
  await expect(
    page.getByRole('button', { name: '取消難題標記' }).first(),
  ).toBeVisible();

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

  await page.getByRole('button', { name: '標記為難題' }).click();
  await page.getByText('圖 D', { exact: true }).click();
  await navigator.getByRole('link', { name: '前往第 1 題' }).click();
  await expect(page.getByText('答對了', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);

  await navigator.getByRole('link', { name: '前往第 49 題' }).click();
  await expect(page.getByText('圖 D', { exact: true }).locator('..').getByRole('radio')).toBeChecked();
  await page.getByRole('button', { name: '對答案' }).click();

  await expectCompactTopbarHeading(page, '作答頁');
  await expect(page.getByText('本回作答結果', { exact: true })).toHaveCount(0);
  const scoreRing = page.getByRole('progressbar', {
    name: '答對 1 題，共 2 題',
  });
  await expect(scoreRing).toBeVisible();
  await expect(scoreRing).toHaveAttribute('aria-valuemin', '0');
  await expect(scoreRing).toHaveAttribute('aria-valuenow', '1');
  await expect(scoreRing).toHaveAttribute('aria-valuemax', '2');
  await expect(scoreRing).toHaveCSS('background-image', /conic-gradient/);
  expect(
    await scoreRing.evaluate((element) =>
      getComputedStyle(element)
        .getPropertyValue('--score-percentage')
        .trim(),
    ),
  ).toBe('50%');
  await expect(scoreRing).toContainText('1 / 2');
  await expect(scoreRing).toContainText('題答對');
  await expect(page.getByText(/100\\.00 分/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '逐題作答結果' })).toBeVisible();
  await expect(page.getByText('1 / 2 題答對')).toBeVisible();
  await expect(page.getByText('詳解', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: '詳解與討論' }).last()).toBeVisible();
  const resultNavigator = page.getByRole('complementary', {
    name: '作答結果題號導覽',
  });
  await expect(resultNavigator).toBeVisible();
  await expect(
    resultNavigator.getByRole('link', {
      name: '查看第 49 題結果（答錯、已標記難題）',
    }),
  ).toHaveAttribute('data-wrong', 'true');
  await expect(
    resultNavigator.getByRole('link', {
      name: '查看第 49 題結果（答錯、已標記難題）',
    }),
  ).toHaveAttribute('data-difficult', 'true');
  await expect(resultNavigator.getByText('答錯＋難題')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /選擇其他試卷|建立其他題組/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '查看作答紀錄' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: '第 49 題使用者筆記' }),
  ).toBeHidden();
  await page.getByText('檢視完整選項與筆記').last().click();
  await expect(
    page.getByRole('region', { name: '第 49 題使用者筆記' }),
  ).toBeVisible();
  await expect(page.getByText('查看題目')).toHaveCount(0);

  await page.goto('/history');
  await expectCompactTopbarHeading(page, '已作答紀錄');
  await expect(page.getByText('1 / 2 題', { exact: true })).toBeVisible();
  await expect(page.getByText('答對題數', { exact: true })).toBeVisible();
  await expect(page.getByText(/100\\.00 分/)).toHaveCount(0);
  await expect(page.getByText(/^答對 /)).toContainText('1');
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

  const [questionResponse, communityResponse, notesResponse] =
    await Promise.all([
      request.get('/questions/law/114/01'),
      request.get('/community'),
      request.get('/notes'),
    ]);
  expect(questionResponse.ok()).toBe(true);
  expect(communityResponse.ok()).toBe(true);
  expect(notesResponse.ok()).toBe(true);

  const [questionHtml, communityHtml, notesHtml] = await Promise.all([
    questionResponse.text(),
    communityResponse.text(),
    notesResponse.text(),
  ]);
  const prompt = '依建築法規定，下列敘述何者錯誤？';
  expect(questionHtml).toContain(prompt);
  expect(questionHtml).toContain(
    '建築基地，為供建築物本身所占之地面及其所應留設之法定空地',
  );
  expect(communityHtml).toContain(prompt);
  expect(notesHtml).toContain(prompt);
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
  await page
    .getByRole('button', {
      name: '放大題目圖片 標示為（1）、（2）、（3）的三個衝擊韌性試片斷口照片',
    })
    .click();
  await expect(
    page.getByRole('dialog', {
      name: '放大檢視 標示為（1）、（2）、（3）的三個衝擊韌性試片斷口照片',
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: '關閉放大圖片' }).last().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
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
  expect(promptImageBounds!.height).toBeGreaterThanOrEqual(200);
  expect(
    Number.parseFloat(
      await options
        .locator('label')
        .first()
        .evaluate((element) => getComputedStyle(element).fontSize),
    ),
  ).toBeGreaterThanOrEqual(15);
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

test('all-credit questions stay concealed until review and count toward the score', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/questions/construction/114/01');
  const navigator = page.getByRole('complementary', { name: '題號導覽' });
  await expect(navigator.getByRole('link')).toHaveCount(80);
  await expect(
    navigator.getByRole('link', { name: '前往第 17 題' }),
  ).toBeVisible();
  await expect(
    navigator.getByRole('link', { name: '前往第 20 題' }),
  ).toBeVisible();
  await expect(page.getByText('收錄題目 1/80')).toBeVisible();

  await page.goto(
    '/questions/construction/114/17?mode=random&questions=construction-114-17',
  );
  await expect(page).toHaveURL(/\/questions\/construction\/114\/17/);
  await expect(page.getByText('收錄題目 1/1')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('一律給分');
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: '對答案' }).click();
  await expect(page.getByText('1 / 1 題答對')).toBeVisible();
  await expect(
    page.getByRole('progressbar', {
      name: '答對 1 題，共 1 題',
    }),
  ).toBeVisible();
  await expect(page.getByText('本題一律給分。')).toBeVisible();
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
  await expectCompactTopbarHeading(page, '考題分析');
  await expect(
    page.getByRole('heading', { name: '選擇分析範圍' }),
  ).toHaveCount(0);
  await expect(page.getByText('總題數 84 題')).toBeVisible();
  const lawAnalysis = page.getByRole('region', { name: '命題分類與對應考古題' });
  await expect(lawAnalysis.getByText('相關法規占比')).toBeVisible();
  await expect(lawAnalysis.getByText(/86 筆法規標註/)).toBeVisible();
  const pieChart = page.getByRole('region', { name: '圓形命題占比圖' });
  await expect(pieChart).toBeVisible();
  await expect(pieChart.getByRole('img')).toHaveCSS(
    'background-image',
    /conic-gradient/,
  );
  await expect(page.getByRole('table')).toHaveCount(0);
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
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: '對答案' }).click();
  const singleFeedback = page.getByRole('status').filter({
    hasText: /答對了|答錯了/,
  });
  await expect(singleFeedback).toBeVisible();
  await expect(singleFeedback).toContainText('標準答案');
  await expect(page).toHaveURL(/mode=single/);
  await expect(page.getByRole('progressbar', { name: /本次得分|答對 .* 題/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重新作答' })).toBeVisible();
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
  await expectCompactTopbarHeading(page, '詳解與討論');
  await expect(page.getByRole('group', { name: '科目' })).toBeVisible();
  await expect(page.getByRole('group', { name: '年度' })).toBeVisible();
  await expect(page.getByRole('group', { name: '題號' })).toBeVisible();
  const correctOption = page.getByRole('listitem', {
    name: /正確選項 D：法定空地之分割要件/,
  });
  await expect(correctOption).toHaveAttribute('data-correct', 'true');
  await expect(correctOption).toHaveCSS(
    'background-color',
    'rgb(230, 248, 240)',
  );
  const explanation = page.getByRole('region', { name: '題目詳解' });
  await expect(explanation).toBeVisible();
  await expect(explanation.getByText('詳解', { exact: true })).toBeVisible();
  await expect(explanation).not.toContainText('正確答案');
  await expect(page.getByText('正確答案', { exact: true })).toHaveCount(0);

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

test('question-bank failures never expose an unrelated editable question', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.route('**/api/questions/**', async (route) => {
    await route.abort();
  });

  await page.goto('/community?question=env-114-01');
  await expect(
    page.getByRole('heading', { name: '題庫載入失敗' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '匿名送出' })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '標記為難題' }),
  ).toHaveCount(0);

  await page.goto('/notes?question=env-114-01');
  await expect(
    page.getByRole('heading', { name: '題庫載入失敗' }),
  ).toBeVisible();
  await expect(page.getByLabel('我的筆記')).toHaveCount(0);
});

test('one failed subject does not hide difficult questions from other subjects', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.addInitScript(() => {
    localStorage.setItem(
      'shaneweb:state',
      JSON.stringify({
        answers: {},
        difficultQuestionIds: ['law-114-01', 'env-114-01'],
        attempts: [],
        notes: {},
        noteImages: {},
        discussionPosts: [],
        likedDiscussionPostIds: [],
      }),
    );
  });
  await page.route('**/api/questions/env', async (route) => {
    await route.abort();
  });

  await page.goto('/difficult');

  await expect(
    page.getByRole('heading', { name: '建築法規與實務' }),
  ).toBeVisible();
  await expect(
    page.getByText(/依建築法規定，下列敘述何者錯誤/).first(),
  ).toBeVisible();
  await expect(
    page.getByText('建築環境控制的難題載入失敗'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '重新載入' })).toBeVisible();
});

test('random quiz draws the requested number of unique questions', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/papers?subject=law&year=114');
  await expect(page.getByRole('region', { name: /建立隨機題組/ })).toHaveCount(0);
  await page.goto('/random?subject=law');
  await expectCompactTopbarHeading(page, '隨機出題');
  const randomQuiz = page.getByRole('region', { name: /建立隨機題組/ });
  await expect(randomQuiz).toBeVisible();
  await expect(
    randomQuiz.getByRole('heading', { name: '建立隨機題組' }),
  ).toHaveCount(0);
  await randomQuiz.getByRole('button').filter({ hasText: /^5 題/ }).click();
  await randomQuiz.getByRole('button', { name: '抽出題組' }).click();
  await expect(page).toHaveURL(/mode=random/);
  await expect(page).toHaveURL(/questions=/);
  await expectCompactTopbarHeading(page, '作答頁');
  await expect(
    page.getByRole('heading', { name: /隨機練習/ }),
  ).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: '題號導覽' }).getByRole('link')).toHaveCount(5);
});

test('a random set spanning several years loads and grades every question', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  // These three questions live in three different papers, so the page cannot
  // carry them all and must load the rest of the subject on demand.
  await page.goto(
    '/questions/law/114/01?mode=random&questions=law-114-01,law-113-01,law-112-01',
  );
  const navigator = page.getByRole('complementary', { name: '題號導覽' });
  await expect(navigator.getByRole('link')).toHaveCount(3);
  await expect(page.getByText('已作答 0 / 3')).toBeVisible();

  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: /下一題/ }).click();
  await expect(page).toHaveURL(/\/questions\/law\/113\/01/);
  await expect(page.getByText('已作答 1 / 3')).toBeVisible();

  await page.getByRole('button', { name: /下一題/ }).click();
  await expect(page).toHaveURL(/\/questions\/law\/112\/01/);
  await page.getByRole('button', { name: '對答案' }).click();
  await expect(page.getByRole('heading', { name: /\/ 3 題答對/ })).toBeVisible();
});

test('a partial random bank cannot create links that truncate the set', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  let releaseQuestionBank!: () => void;
  const questionBankReady = new Promise<void>((resolve) => {
    releaseQuestionBank = resolve;
  });
  await page.route('**/api/questions/law', async (route) => {
    await questionBankReady;
    await route.continue();
  });

  const questionIds = 'law-114-01,law-114-02,law-113-01';
  await page.goto(
    `/questions/law/114/01?mode=random&questions=${questionIds}`,
  );
  const navigator = page.getByRole('complementary', { name: '題號導覽' });
  await expect(navigator.getByRole('link')).toHaveCount(0);
  await expect(navigator.getByText('正在載入這次抽出的題目…')).toBeVisible();

  releaseQuestionBank();

  await expect(navigator.getByRole('link')).toHaveCount(3);
  const href = await navigator.getByRole('link').nth(1).getAttribute('href');
  expect(href).not.toBeNull();
  const target = new URL(href!, 'http://127.0.0.1:3000');
  expect(target.searchParams.get('questions')).toBe(questionIds);
  expect(target.searchParams.get('quizSession')).toBeTruthy();
});

test('a new random session does not inherit answers from the same set', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  const sessionlessUrl =
    '/questions/law/114/01?mode=random&questions=law-114-01,law-114-02';
  await page.goto(sessionlessUrl);
  await expect(page).toHaveURL(/quizSession=/);
  const firstSession = new URL(page.url()).searchParams.get('quizSession');
  expect(firstSession).toBeTruthy();
  await page.getByRole('radio').first().check();
  await expect(page.getByText('已作答 1 / 2')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((sessionId) => {
        const stored = JSON.parse(
          localStorage.getItem('shaneweb:quiz-progress') ?? '{}',
        );
        const scope = Object.keys(stored.scopes ?? {}).find((key) =>
          key.includes(encodeURIComponent(sessionId ?? '')),
        );
        return scope
          ? stored.scopes[scope]?.['law-114-01']?.selected
          : undefined;
      }, firstSession),
    )
    .toBe(0);

  await page.goto(sessionlessUrl);
  await expect(page).toHaveURL(/quizSession=/);
  const secondSession = new URL(page.url()).searchParams.get('quizSession');

  expect(secondSession).toBeTruthy();
  expect(secondSession).not.toBe(firstSession);
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(page.getByText('已作答 0 / 2')).toBeVisible();
});

test('draft answers survive a reload in the middle of a paper', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/questions/law/114/01');
  await page.getByRole('radio').first().check();
  await expect(page.getByText('已作答 1 / 80')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);
  await expect(page.getByText('已作答 1 / 80')).toBeVisible();
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
  const noteNavigator = page.getByRole('complementary', {
    name: '筆記題號導覽',
  });
  await expect(noteNavigator).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole('group', { name: '題號' })
        .getByRole('button', { name: '第 1 題' })
        .evaluate((element) => getComputedStyle(element).width),
    )
    .toBe('38px');
  const [editorBounds, navigatorBounds] = await Promise.all([
    page.getByLabel('我的筆記').boundingBox(),
    noteNavigator.boundingBox(),
  ]);
  expect(editorBounds).not.toBeNull();
  expect(navigatorBounds).not.toBeNull();
  expect(navigatorBounds!.x).toBeGreaterThan(editorBounds!.x);
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
  await expect(
    noteNavigator.getByRole('button', { name: '第 1 題（有筆記）' }),
  ).toHaveAttribute('data-noted', 'true');
  await page.reload();
  await expect(page.getByLabel('我的筆記')).toHaveValue('法定空地分割辦法由中央主管建築機關定之。');
  await expect(page.getByRole('img', { name: 'note.png' })).toBeVisible();
  await expect(
    page
      .getByRole('complementary', { name: '筆記題號導覽' })
      .getByRole('button', { name: '第 1 題（有筆記）' }),
  ).toHaveAttribute('data-noted', 'true');
});

test('all retained routes support direct visits and removed routes return 404', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  const routes = [
    { path: '/', title: '首頁' },
    { path: '/papers?subject=law', title: '歷屆試題' },
    { path: '/random?subject=law', title: '隨機出題' },
    { path: '/questions/law/114/01', title: '作答頁' },
    { path: '/analysis', title: '考題分析' },
    { path: '/community', title: '詳解與討論' },
    { path: '/notes', title: '使用者筆記' },
    { path: '/difficult', title: '難題標記' },
    { path: '/history', title: '已作答紀錄' },
  ] as const;

  for (const route of routes) {
    const response = await page.goto(route.path);
    expect(response?.ok()).toBe(true);
    await expect(page.locator('main')).toBeVisible();
    await expectCompactTopbarHeading(page, route.title);
    await page.reload();
    await expect(page.locator('main')).toBeVisible();
    await expectCompactTopbarHeading(page, route.title);
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
  await expectCompactTopbarHeading(page, '隨機出題');
  await page.getByRole('button', { name: '開啟選單' }).click();
  await page.getByRole('link', { name: '歷屆試題' }).click();
  await expect(page).toHaveURL(/\/papers$/);
  await expectCompactTopbarHeading(page, '歷屆試題');
  await expect(
    page.getByRole('heading', { name: '選擇科目與年度' }),
  ).toHaveCount(0);
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test('question images remain responsive on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/questions/construction/114/49');
  await expect(page.getByRole('img', { name: '圖 A 至圖 D 四種屋頂設備基礎防水收頭細部剖面圖' })).toBeVisible();
  const answerOptions = page.getByRole('radiogroup', { name: '請選擇答案' });
  await expect(answerOptions.locator('img')).toHaveCount(0);
  const answerCard = answerOptions.locator('xpath=ancestor::section[1]');
  const questionNavigator = page.getByRole('complementary', {
    name: '題號導覽',
  });
  const [answerCardBounds, questionNavigatorBounds] = await Promise.all([
    answerCard.boundingBox(),
    questionNavigator.boundingBox(),
  ]);
  expect(answerCardBounds).not.toBeNull();
  expect(questionNavigatorBounds).not.toBeNull();
  expect(answerCardBounds!.y + answerCardBounds!.height).toBeLessThanOrEqual(
    questionNavigatorBounds!.y,
  );
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
