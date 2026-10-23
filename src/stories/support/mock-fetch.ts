import { fixtureQuestionData } from '../fixtures/questions';

/**
 * 故事可以用 `parameters.fetchMocks` 攔截網站 API（例如 `/api/admin/...`）。
 * 題庫資料（`/question-data/...`）一律由範例題庫回應，不能在單一故事裡改：
 * 網站會在同一個分頁裡快取題庫請求，換故事時不會重新下載。
 */
export interface FetchMockRequest {
  url: URL;
  method: string;
  headers: Headers;
  /** 送出的 JSON 內容；不是 JSON 時為 undefined。 */
  body: unknown;
}

export interface FetchMockResponse {
  status?: number;
  body?: unknown;
}

export interface FetchMock {
  /** 比對網址路徑（不含網域），字串需完全相同。 */
  path: string | RegExp;
  method?: string;
  status?: number;
  body?: unknown;
  /**
   * 依送出的內容決定回應，例如檢查金鑰、回傳剛存檔的資料，故事裡輸入不同內容就看得到
   * 不同結果。有設定時不使用 status 與 body。
   */
  respond?: (request: FetchMockRequest) => FetchMockResponse | Promise<FetchMockResponse>;
  /** 延遲回應的毫秒數，用來看「處理中」的畫面。 */
  delayMs?: number;
}

const questionDataPath = /^\/question-data\/([a-z]+)\/(\d+)\.json$/;
let storyMocks: readonly FetchMock[] = [];
let installed = false;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body ?? null), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requestUrl(input: RequestInfo | URL) {
  if (input instanceof Request) return new URL(input.url);
  return new URL(String(input), window.location.href);
}

export function setStoryFetchMocks(mocks: readonly FetchMock[] | undefined) {
  storyMocks = mocks ?? [];
}

export function installFetchMock() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = requestUrl(input);
    if (url.origin !== window.location.origin) return realFetch(input, init);

    const questionData = questionDataPath.exec(url.pathname);
    if (questionData) {
      const [, subject, year] = questionData;
      return jsonResponse(fixtureQuestionData[`${subject}:${year}`] ?? []);
    }

    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    const mock = storyMocks.find(
      (item) =>
        (item.method ?? 'GET').toUpperCase() === method &&
        (typeof item.path === 'string'
          ? item.path === url.pathname
          : item.path.test(url.pathname)),
    );
    if (mock) {
      if (mock.delayMs) {
        await new Promise((resolve) => window.setTimeout(resolve, mock.delayMs));
      }
      if (!mock.respond) return jsonResponse(mock.body, mock.status);
      const request = new Request(input, init);
      const text = await request.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : undefined;
      } catch {
        body = undefined;
      }
      const response = await mock.respond({
        url,
        method,
        headers: request.headers,
        body,
      });
      return jsonResponse(response.body, response.status);
    }
    if (url.pathname.startsWith('/api/')) {
      return jsonResponse(
        { error: 'Storybook 沒有這個 API，請在故事裡加 fetchMocks。' },
        404,
      );
    }
    return realFetch(input, init);
  };
}
