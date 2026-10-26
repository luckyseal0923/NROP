import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createVersionChecker, createEditGuard } from '../src/app-version.js';

const current = { version: '1.1.0', buildId: 'a'.repeat(32), builtAt: '2026-10-27T01:00:00Z' };
const next = { ...current, version: '1.2.0', buildId: 'b'.repeat(32) };
const response = (release = current) => ({ ok: true, headers: { get: () => 'application/json' }, json: async () => release });
function mount(options = {}) {
  const dom = new JSDOM(readFileSync('index.html', 'utf8'), { url: 'https://nrop.example.invalid/', pretendToBeVisual: true });
  const win = dom.window, $ = selector => win.document.querySelector(selector), calls = [], reloads = [];
  let getResponse = () => response();
  const checker = createVersionChecker({ window: win, current, fetch: async (...args) => { calls.push(args); return getResponse(...args); },
    reload: buildId => reloads.push(buildId), ...options });
  return { win, $, calls, reloads, checker, setResponse: fn => { getResponse = fn; }, close() { checker.destroy(); dom.window.close(); } };
}

test('頁尾顯示目前版本，手動檢查避開快取且不傳送帳號資料', async () => {
  const app = mount({ base: '/platform/' });
  try {
    await app.checker.check();
    assert.equal(app.$('#appVersion').textContent, 'NROP v1.1.0');
    assert.match(app.$('#appVersion').title, /2026.*aaaa/si);
    assert.equal(app.$('#versionStatus').textContent, '目前已是最新版本');
    const [url, options] = app.calls[0];
    assert.equal(new URL(url).pathname, '/platform/version.json');
    assert.ok(new URL(url).searchParams.get('_check'));
    assert.equal(options.cache, 'no-store');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.body, undefined);
    assert.ok(app.$('#updateNotice').classList.contains('hidden'));
  } finally { app.close(); }
});

test('相同版號重新建置仍提示更新，不自動重新整理；檢查失敗保留已知更新', async () => {
  const app = mount();
  try {
    await app.checker.check();
    app.setResponse(() => response({ ...next, version: current.version }));
    await app.checker.check();
    assert.ok(!app.$('#updateNotice').classList.contains('hidden'));
    assert.equal(app.$('#appVersion').textContent, 'NROP v1.1.0');
    assert.equal(app.$('#updateTitle').textContent, '可更新至 v1.1.0');
    assert.deepEqual(app.reloads, []);
    app.setResponse(() => { throw new Error('offline'); });
    await app.checker.check();
    assert.match(app.$('#versionStatus').textContent, /無法重新檢查/);
    assert.ok(!app.$('#updateNotice').classList.contains('hidden'));
    app.setResponse(() => response());
    await app.checker.check();
    assert.ok(app.$('#updateNotice').classList.contains('hidden'));
  } finally { app.close(); }
});

test('404、HTML 回退與損壞的版本檔不會被誤報為最新版，可手動重試', async () => {
  const app = mount();
  try {
    await app.checker.check();
    for (const invalid of [() => ({ ok: false }), () => ({ ok: true, headers: { get: () => 'text/html' } }),
      () => response({ ...next, version: '<img src=x>' }), () => response({ ...next, buildId: 'invalid' }),
      () => response({ ...next, builtAt: 'invalid' }), () => ({ ...response(), json: async () => { throw new Error('bad json'); } })]) {
      app.setResponse(invalid);
      assert.equal(await app.checker.check(), false);
      assert.equal(app.$('#versionStatus').textContent, '無法檢查更新，請稍後重試');
      assert.ok(app.$('#updateNotice').classList.contains('hidden'));
      assert.equal(app.$('#checkVersion').disabled, false);
    }
    app.setResponse(() => response());
    assert.equal(await app.checker.check(), true);
  } finally { app.close(); }
});

test('重複點擊共用一次請求，網路離線後仍可再查', async () => {
  let releaseResponse;
  const app = mount();
  try {
    await app.checker.check();
    app.setResponse(() => new Promise(resolve => { releaseResponse = resolve; }));
    const one = app.checker.check(), two = app.checker.check();
    assert.equal(one, two); assert.equal(app.calls.length, 2);
    releaseResponse(response()); await one;
    Object.defineProperty(app.win.navigator, 'onLine', { configurable: true, value: false });
    assert.equal(await app.checker.check(), false);
    Object.defineProperty(app.win.navigator, 'onLine', { configurable: true, value: true });
    app.setResponse(() => response(next));
    await app.checker.check();
    assert.ok(!app.$('#updateNotice').classList.contains('hidden'));
  } finally { app.close(); }
});

test('開啟、每五分鐘與返回前景會檢查，背景暫停且銷毀後不再查', async () => {
  let tick, frequency, cleared = false;
  const dom = new JSDOM(readFileSync('index.html', 'utf8'), { url: 'https://nrop.example.invalid/', pretendToBeVisual: true });
  const win = dom.window; let requests = 0, visibility = 'visible';
  Object.defineProperty(win.document, 'visibilityState', { get: () => visibility });
  win.setInterval = (callback, ms) => { tick = callback; frequency = ms; return 1; };
  win.clearInterval = () => { cleared = true; };
  const checker = createVersionChecker({ window: win, current, foregroundMinMs: 0, fetch: async () => { requests++; return response(); } });
  try {
    await checker.check(); assert.equal(requests, 1); assert.equal(frequency, 300000);
    visibility = 'hidden'; tick(); await Promise.resolve(); assert.equal(requests, 1);
    visibility = 'visible'; win.document.dispatchEvent(new win.Event('visibilitychange')); await checker.check(); assert.equal(requests, 2);
    tick(); await checker.check(); assert.equal(requests, 3);
    win.dispatchEvent(new win.Event('online')); await checker.check(); assert.equal(requests, 4);
    checker.destroy(); assert.ok(cleared); tick(); await checker.check(); assert.equal(requests, 4);
  } finally { checker.destroy(); win.close(); }
});

test('更新按鈕會阻擋處理中狀態，未儲存時可取消；明確同意後才導向新版', async () => {
  let dirty = false, busy = false, confirmations = 0;
  const app = mount({ hasUnsavedChanges: () => dirty, isBusy: () => busy });
  try {
    await app.checker.check(); app.setResponse(() => response(next)); await app.checker.check();
    app.win.confirm = () => { confirmations++; return false; };
    busy = true; app.$('#reloadVersion').click(); assert.deepEqual(app.reloads, []); assert.equal(confirmations, 0);
    busy = false; dirty = true; app.$('#reloadVersion').click(); assert.deepEqual(app.reloads, []); assert.equal(confirmations, 1);
    app.win.confirm = () => true; app.$('#reloadVersion').click(); assert.deepEqual(app.reloads, [next.buildId]);
    dirty = false; app.$('#reloadVersion').click(); assert.deepEqual(app.reloads, [next.buildId, next.buildId]);
  } finally { app.close(); }
});

test('超時結束檢查並顯示失敗，不會卡住按鈕', async () => {
  const app = mount({ timeoutMs: 15 });
  try {
    await app.checker.check();
    app.setResponse((url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true })));
    assert.equal(await app.checker.check(), false);
    assert.equal(app.$('#checkVersion').disabled, false);
    assert.match(app.$('#versionStatus').textContent, /無法檢查/);
  } finally { app.close(); }
});

test('未儲存判斷涵蓋動態欄位、勾選框及下拉選單；儲存與登出後清除基準', () => {
  const dom = new JSDOM('<input id="staff" value="2"><input id="total" readonly value="2"><input id="open" type="checkbox" checked><select><option>A</option><option>B</option></select><div id="fields"></div>');
  const doc = dom.window.document, edits = createEditGuard(doc), staff = doc.querySelector('#staff');
  try {
    staff.value = '3.123'; edits.capture('report', 'input'); assert.equal(edits.hasChanges(), false);
    staff.value = '3.124'; assert.equal(edits.hasChanges(), true);
    staff.value = '3.123'; doc.querySelector('#total').value = '9'; assert.equal(edits.hasChanges(), false);
    doc.querySelector('#fields').innerHTML = '<input value="7">'; edits.capture('report', 'input');
    doc.querySelector('#fields input').value = '8'; assert.equal(edits.hasChanges(), true);
    edits.capture('report', 'input'); assert.equal(edits.hasChanges(), false);
    edits.capture('accounts', 'select,#open'); doc.querySelector('select').value = 'B'; assert.equal(edits.hasChanges(), true);
    doc.querySelector('select').value = 'A'; doc.querySelector('#open').checked = false; assert.equal(edits.hasChanges(), true);
    edits.reset(); assert.equal(edits.hasChanges(), false);
  } finally { dom.window.close(); }
});

test('本機開發顯示開發標記，未部署的變更不誤報為網站新版', async () => {
  const app = mount({ enabled: false });
  try {
    await app.checker.check(); app.$('#checkVersion').click();
    assert.equal(app.calls.length, 0); assert.match(app.$('#appVersion').textContent, /本機開發/);
    assert.ok(app.$('#checkVersion').disabled);
  } finally { app.close(); }
});
