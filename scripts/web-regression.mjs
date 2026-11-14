// Run against a local test stack with Playwright and Chromium available.
// Creates test accounts in that stack's database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = new URL(process.env.TEST_BASE_URL ?? 'http://127.0.0.1:8080');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Use a local test stack');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE
  ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
  : undefined);
const sessionKey = 'astralingo.session';
const button = (page, name) => page.getByRole('button', { name, exact: true });

async function register(page) {
  await page.goto(new URL('/register', base).href);
  await page.getByLabel('Tên của bạn', { exact: true }).fill('Web regression');
  await page.getByLabel('Email', { exact: true }).fill(`web-regression-${randomUUID()}@example.test`);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Regression@12345');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('Regression@12345');
  await button(page, 'Tạo tài khoản').click();
  await page.waitForURL('**/home');
}

async function verifyLogout() {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await register(page);
    await button(page, 'Mở hồ sơ cá nhân').click();
    await page.waitForURL('**/profile');
    await page.evaluate(key => {
      const remove = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (entry) {
        if (entry === key) throw new Error('Injected deletion failure');
        return remove.call(this, entry);
      };
    }, sessionKey);
    await button(page, 'Đăng xuất').click();
    await page.waitForURL('**/login');
    assert.ok(!(await page.evaluate(key => sessionStorage.getItem(key), sessionKey)));
    await page.reload();
    await page.getByText('Chào bạn trở lại!', { exact: true }).waitFor();
    console.log('PASS: logout with a failed storage deletion cannot restore the token');
  } finally { await context.close(); }
}

async function verifyPagination() {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.route('**/api/courses?*', async route => {
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
      page.waitForResponse(r => {
        const url = new URL(r.url());
        return url.pathname === '/api/courses' && !url.searchParams.has('category');
      }),
      button(page, 'Xóa bộ lọc').click(),
    ]);
    assert.equal(new URL(response.url()).searchParams.get('page'), '1');
    await page.getByText('Tiếng Anh từ bước đầu', { exact: true }).waitFor();
    console.log('PASS: returning to a prior filter starts at page one');
  } finally { await context.close(); }
}

try {
  await verifyLogout();
  await verifyPagination();
} finally {
  await browser.close();
}
