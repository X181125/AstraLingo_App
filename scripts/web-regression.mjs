// Run against a local test stack with Playwright and Chromium available.
// Creates test accounts in that stack's database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = new URL(process.env.TEST_BASE_URL ?? 'http://127.0.0.1:8080');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Use a local test stack');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const sessionKey = 'astralingo.session';
const button = (page, name) => page.getByRole('button', { name, exact: true });

async function register(page, completeOnboarding = false) {
  await page.goto(new URL('/register', base).href);
  await page.getByLabel('First Name', { exact: true }).fill('Web');
  await page.getByLabel('Last Name', { exact: true }).fill('Regression');
  await page.getByLabel('Email', { exact: true }).fill(`web-regression-${randomUUID()}@example.test`);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Regression@12345');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('Regression@12345');
  await button(page, 'Tạo tài khoản').click();
  await page.waitForURL('**/onboarding');
  if (completeOnboarding) {
    for (let step = 1; step < 7; step++) await button(page, 'Tiếp tục').click();
    await button(page, 'Hoàn tất thiết lập').click();
    await button(page, 'Vào trang chủ').click();
  } else await button(page, 'Để sau').click();
  await page.waitForURL('**/home');
}

async function verifyLogout() {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await register(page);
    await button(page, 'Mở hồ sơ cá nhân').click();
    await page.waitForURL('**/profile');
    await page.evaluate((key) => {
      const remove = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (entry) {
        if (entry === key) throw new Error('Injected deletion failure');
        return remove.call(this, entry);
      };
    }, sessionKey);
    await button(page, 'Đăng xuất').click();
    await page.waitForURL('**/login');
    assert.ok(!(await page.evaluate((key) => sessionStorage.getItem(key), sessionKey)));
    await page.reload();
    await page.getByText('Welcome back', { exact: true }).waitFor();
    console.log('PASS: logout with a failed storage deletion cannot restore the token');
  } finally {
    await context.close();
  }
}

async function verifyPagination() {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.route('**/api/courses?*', async (route) => {
      const url = new URL(route.request().url());
      url.searchParams.set('limit', '2');
      await route.fulfill({ response: await route.fetch({ url: url.href }) });
    });
    await register(page);
    await button(page, 'Xem thêm khóa học').click();
    await page.getByText('Lắng nghe cuộc sống', { exact: true }).waitFor();
    await button(page, 'Danh mục Đọc hiểu').click();
    await page.getByText('Đọc những điều thú vị', { exact: true }).waitFor();
    await page.getByText('Lắng nghe cuộc sống', { exact: true }).waitFor({ state: 'hidden' });
    const [response] = await Promise.all([
      page.waitForResponse((r) => {
        const url = new URL(r.url());
        return url.pathname === '/api/courses' && !url.searchParams.has('category');
      }),
      button(page, 'Xóa bộ lọc').click(),
    ]);
    assert.equal(new URL(response.url()).searchParams.get('page'), '1');
    await page.getByText('Tiếng Anh từ bước đầu', { exact: true }).waitFor();
    console.log('PASS: returning to a prior filter starts at page one');
  } finally {
    await context.close();
  }
}

async function verifyLearning() {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await register(page, true);
    await page.goto(new URL('/study', base).href);
    await button(page, 'Mini Quiz').click();
    await page
      .getByRole('button', { name: /Grammar/i })
      .first()
      .click();
    await button(page, 'Submit exam').click();
    await button(page, 'Submit now').click();
    await page.getByText('0% correct', { exact: true }).waitFor();
    await button(page, 'View exam history').click();
    await page.waitForURL('**/study/exam/history');

    await page.goto(new URL('/practice/english-first-steps-1', base).href);
    await button(page, 'Da Nang').click();
    await button(page, 'Plays badminton').click();
    await button(page, 'Nộp đáp án').click();
    await page.getByRole('heading', { name: '100/100 · 2/2 câu đúng' }).waitFor();

    await button(page, 'Các bộ câu hỏi và lượt làm').click();
    await button(page, 'Bắt đầu làm bộ này').click();
    await button(page, 'Da Nang').click();
    await button(page, 'Plays badminton').click();
    await button(page, 'Nộp bộ câu hỏi').click();
    await page.getByRole('heading', { name: '2/2 câu đúng · 100/100' }).waitFor();

    await page.goto(new URL('/study/content/listening/english-first-steps-2/transcript', base).href);
    await button(page, 'Ẩn transcript').waitFor();
    await button(page, 'Phát âm thanh').click();
    await page
      .waitForFunction(
        () => [...document.querySelectorAll('audio')].some((audio) => audio.currentTime > 0.05),
        null,
        { timeout: 5000 },
      )
      .catch(async () => {
        // Expo Audio also supports detached media elements; the player state reports playback there.
        await button(page, 'Tạm dừng').waitFor();
      });

    await page.goto(new URL('/practice/english-first-steps-4', base).href);
    await page
      .getByLabel('Bài viết của bạn', { exact: true })
      .fill('I walk to class in the morning. I read at home after lunch.');
    await button(page, 'Lưu bản nháp').click();
    await button(page, 'Tiếp tục bản nháp').click();
    await button(page, 'Nộp bài').click();
    await page.getByText('Đã nộp bài. Bạn có thể xem lại trong lịch sử.', { exact: true }).first().waitFor();

    await page.goto(new URL('/dictionary', base).href);
    await page.getByLabel('Từ hoặc câu tiếng Anh').fill('garden');
    await button(page, 'Tìm trong từ điển').click();
    await page.getByText('garden · Khu vườn', { exact: true }).waitFor();
    await button(page, 'Lưu từ').first().click();
    await page.getByLabel('Từ hoặc câu tiếng Anh').fill('photosynthesis');
    await button(page, 'Tìm trong từ điển').click();
    await page.getByText(/^photosynthesis · /).waitFor();
    await button(page, 'Từ đã lưu').click();
    await page.getByText('garden · Khu vườn', { exact: true }).waitFor();

    await page.goto(new URL('/flashcards', base).href);
    await button(page, 'My Lists').click();
    await button(page, 'Create Word List').click();
    await page.getByLabel('Tên bộ thẻ').fill('Reading words');
    await button(page, 'Tạo bộ thẻ').click();
    await page.getByLabel('Mặt trước').fill('garden');
    await page.getByLabel('Mặt sau').fill('khu vườn');
    await button(page, 'Thêm thẻ').click();
    await button(page, 'Ôn thẻ đến hạn').click();
    await button(page, 'Lật thẻ').click();
    await button(page, 'Nhớ được').click();
    await page.getByText('0 thẻ đến hạn · 1/1 thẻ đã ôn', { exact: true }).waitFor();

    await page.goto(new URL('/profile', base).href);
    await page.getByText('1 ngày liên tiếp · 3 bài đã nộp', { exact: true }).waitFor();
    await button(page, 'Chỉnh sửa hồ sơ').click();
    await page.getByLabel('Tên hiển thị').fill('Learning Preview');
    await button(page, 'Tối').click();
    await button(page, 'Lưu hồ sơ').click();
    await page.getByText('Đã lưu hồ sơ.', { exact: true }).waitFor();
    await page.goto(new URL('/profile', base).href);
    await page.getByText('Learning Preview', { exact: true }).waitFor();
    console.log('PASS: onboarding, Quiz, Reading, Writing, Dictionary, Flashcards and persisted progress');
  } finally {
    await context.close();
  }
}

async function verifyNavigation() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await ctx.newPage();
    await register(page);
    for (const name of ['Categories', 'Popular Courses', 'Top Mentor'])
      await page.getByRole('heading', { name, exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await button(page, 'Choose an exam').click();
    await page.getByRole('heading', { name: 'All Tests', exact: true }).waitFor();
    await page.goto(new URL('/study', base).href);
    await button(page, 'Reading Practice').click();
    await page.getByRole('button', { name: 'Hello, world!', exact: true }).click();
    await button(page, 'Saved words').click();
    await page.getByLabel('Word or phrase').fill('morning');
    await page.getByLabel('Meaning', { exact: true }).fill('buổi sáng');
    await button(page, 'Save word').click();
    await page.getByText('morning · buổi sáng', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('morning · buổi sáng', { exact: true }).waitFor();
    await page.goto(new URL('/dictionary', base).href);
    await button(page, 'Browse all words').click();
    await page.getByRole('heading', { name: 'English Explorer' }).waitFor();
    await page.goto(new URL('/profile', base).href);
    await button(page, 'FAQ').click();
    await button(page, 'Where are my scores?').click();
    await page.getByText(/Open Exam history/).waitFor();
    console.log('PASS: mobile navigation from Home, Reading, Dictionary and Profile');
  } finally {
    await ctx.close();
  }
}

async function verifyWritingAndListeningTools() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await register(page);
    await page.goto(new URL('/study/content/listening/english-first-steps-2', base).href);
    const related = page.waitForResponse(
      (response) => /\/listening-audios\/\d+\/related\?/.test(response.url()) && response.ok(),
    );
    // Reload after installing the response listener so faster local runs are also covered.
    await page.reload();
    const list = (await (await related).json()).data.items;
    assert.ok(list.length > 0);
    await page.getByRole('heading', { name: 'Bài nghe gợi ý', exact: true }).waitFor();
    await button(page, list[0].contentItem.title).click();
    await page.waitForURL(`**/study/content/listening/${list[0].id}`);
    await page.getByRole('heading', { name: list[0].contentItem.title, exact: true }).waitFor();

    await page.route('**/api/learn/ai/capabilities', (route) => {
      if (route.request().resourceType() === 'fetch')
        return route.fulfill({ json: { success: true, data: { gemini: true } } });
      return route.continue();
    });
    await page.route('**/api/writing-prompts/*/ai/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/outline')) {
        assert.equal(route.request().method(), 'POST');
        return route.fulfill({
          json: { success: true, data: { text: 'Fixture outline covering two ideas.' } },
        });
      }
      if (path.endsWith('/draft/coach-chat')) {
        assert.deepEqual(route.request().postDataJSON(), {
          text: 'I read books every day.',
          context: 'How do I start?',
        });
        return route.fulfill({ json: { success: true, data: { text: 'Fixture answer for the learner.' } } });
      }
      return route.continue();
    });
    await page.goto(new URL('/study/content/writing/english-first-steps-4', base).href);
    await page.getByRole('heading', { name: 'Trợ lý viết', exact: true }).waitFor();
    await button(page, 'Lập dàn ý').click();
    await button(page, 'Nhận hướng dẫn').click();
    await page.getByText('Fixture outline covering two ideas.', { exact: true }).waitFor();
    await button(page, 'Start writing').click();
    await page.getByLabel('Bài viết của bạn', { exact: true }).fill('I read books every day.');
    await button(page, 'Hỏi trợ lý').click();
    await page.getByLabel('Câu hỏi cho trợ lý', { exact: true }).fill('How do I start?');
    await button(page, 'Nhận góp ý bản nháp').click();
    await page.getByText('Fixture answer for the learner.', { exact: true }).waitFor();
    let gradedSubmission;
    await page.route('**/api/study/lessons/english-first-steps-4/attempts', async route => {
      if (!gradedSubmission) return route.continue();
      const response = await route.fetch();
      const payload = await response.json();
      payload.data = payload.data.map(item => item.id === gradedSubmission.id ? gradedSubmission : item);
      return route.fulfill({ response, json: payload });
    });
    await page.route('**/api/study/attempts/*/feedback', async route => {
      const id = new URL(route.request().url()).pathname.split('/').at(-2);
      const history = await route.fetch({
        url: new URL('/api/study/lessons/english-first-steps-4/attempts', base).href,
        method: 'GET',
        postData: undefined,
      });
      const submitted = (await history.json()).data.find(item => item.id === id);
      assert.equal(submitted.state, 'SUBMITTED');
      gradedSubmission = { ...submitted, state: 'COMPLETED', score: 80,
        feedback: { score: 80, strengths: ['Clear idea'], improvements: [], criteria: [], segments: [] } };
      return route.fulfill({ json: { success: true, data: gradedSubmission } });
    });
    await page.route('**/api/writing-submissions/*/ai/**', (route) => {
      const action = new URL(route.request().url()).pathname.split('/').at(-1);
      if (action === 'band-estimate')
        return route.fulfill({
          json: {
            success: true,
            data: {
              overallBand: 6.5,
              cefrLevel: 'B2',
              rationale: 'Fixture band rationale.',
              confidence: 'medium',
            },
          },
        });
      if (action === 'generate-practice')
        return route.fulfill({
          json: {
            success: true,
            data: {
              questions: [
                {
                  prompt: 'Pick the correct spelling.',
                  options: ['books', 'bookss'],
                  answer: 0,
                  explanation: 'Use books.',
                },
              ],
            },
          },
        });
      if (action === 'create-flashcards')
        return route.fulfill({
          json: {
            success: true,
            data: {
              cards: [{ front: 'books', back: 'sách' }],
            },
          },
        });
      return route.continue();
    });
    await button(page, 'Nộp bài').click();
    await page.getByText('Đã nộp bài. Bạn có thể xem lại trong lịch sử.', { exact: true }).first().waitFor();
    await page.goto(new URL('/study/content/writing/english-first-steps-4/result', base).href);
    await button(page, 'Chấm và nhận phản hồi AI').click();
    await button(page, 'Ước lượng band').click();
    await page.getByText('Fixture band rationale.', { exact: true }).waitFor();
    await button(page, 'Sinh bài luyện').click();
    await button(page, 'books').click();
    await button(page, 'Xem điểm bài luyện').click();
    await page.getByRole('heading', { name: '100/100 · 1/1 câu đúng' }).waitFor();
    await button(page, 'Tạo Flashcard từ bài viết').click();
    await page.getByText('books · sách', { exact: true }).waitFor();
    console.log('PASS: related Listening navigation and Writing prep/draft tools with simulated Gemini');
  } finally {
    await context.close();
  }
}

async function verifyPhoneFlows() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ['microphone'],
  });
  try {
    const page = await context.newPage();
    await register(page);
    await page.goto(new URL('/study/exam', base).href);
    await page
      .getByRole('button', { name: /SAT.*4/i })
      .first()
      .click();
    await button(page, 'Start exam').click();
    const first = page.getByRole('radio', { name: 'Module 1 · Question 1, A', exact: true });
    await first.click();
    await page.waitForFunction(() => document.querySelector('[role="radio"][aria-checked="true"]'));
    await page.getByRole('tab', { name: 'Module 2' }).click();
    await page.getByRole('radio', { name: 'Module 2 · Question 1, B', exact: true }).click();
    await page.getByText('2 of 66 answered', { exact: true }).waitFor();
    await button(page, 'Submit exam').click();
    await button(page, 'Submit now').click();
    await page.getByText(/^[0-9]+ \/ 66$/).waitFor();
    await button(page, 'View exam history').click();
    await page.getByRole('button', { name: /SAT Practice Test 4/i }).waitFor();

    await page.goto(new URL('/practice/english-first-steps-3', base).href);
    await button(page, 'Bắt đầu ghi âm').click();
    await page.getByText(/Đang ghi 0:0[1-9]/).waitFor();
    await button(page, 'Dừng ghi âm').click();
    await button(page, 'Nghe bản ghi mới').waitFor();
    await button(page, 'Nộp bài').click();
    await page.getByText('Đã nộp bài. Bạn có thể xem lại trong lịch sử.', { exact: true }).first().waitFor();
    await page.reload();
    await button(page, 'Xem bài làm').click();
    await button(page, 'Phát âm thanh').waitFor();
    console.log('PASS: phone viewport, both SAT modules, raw score, history and persisted microphone upload');
  } finally {
    await context.close();
  }
}

try {
  await verifyLogout();
  await verifyPagination();
  await verifyLearning();
  await verifyPhoneFlows();
  await verifyNavigation();
  await verifyWritingAndListeningTools();
} finally {
  await browser.close();
}
