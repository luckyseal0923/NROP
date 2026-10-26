// 只查詢網站發布的靜態版本檔，不需要 Supabase 或額外帳號權限。
export function createVersionChecker({ window: win, current, base = '/', enabled = true,
  hasUnsavedChanges = () => false, isBusy = () => false,
  fetch: fetchVersion = (...args) => win.fetch(...args),
  reload = buildId => {
    const url = new URL(win.location.href);
    url.searchParams.set('_nrop_build', buildId);
    win.location.replace(url.href);
  }, intervalMs = 300000, foregroundMinMs = 60000, timeoutMs = 10000 }) {
  const doc = win.document, $ = selector => doc.querySelector(selector);
  const checkButton = $('#checkVersion'), reloadButton = $('#reloadVersion');
  const status = $('#versionStatus'), notice = $('#updateNotice');
  const stamp = new Date(current.builtAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
  const label=release=>/^NROP-\d{8}-(?:0[1-9]|[1-9]\d)$/.test(release.displayVersion)?release.displayVersion:`NROP v${release.version}`;
  $('#appVersion').textContent = `${label(current)}${enabled ? '' : '（本機開發）'}`;
  $('#appVersion').title = `建置時間：${stamp}（臺灣時間）\n識別碼：${current.buildId.slice(0, 8)}`;
  let latest = null, pending = null, controller = null, timer = null, stopped = false, lastCheck = -Infinity;
  function showRelease(release) {
    latest = release.buildId === current.buildId ? null : release;
    notice.classList.toggle('hidden', !latest);
    doc.body.classList.toggle('has-version-update', !!latest);
    if (latest) {
      $('#updateTitle').textContent = `可更新至 ${label(latest)}`;
      $('#updateMessage').textContent = '請先暫存填報內容，再重新整理以更新。';
    }
  }
  function check({ automatic = false } = {}) {
    if (stopped || !enabled) return Promise.resolve(false);
    if (pending) return pending;
    if (automatic && (doc.visibilityState === 'hidden' || Date.now() - lastCheck < foregroundMinMs)) return Promise.resolve(false);
    lastCheck = Date.now();
    checkButton.disabled = true;
    status.textContent = '正在檢查更新…';
    pending = (async () => {
      let timeout;
      try {
        if (win.navigator.onLine === false) throw new Error('offline');
        controller = new win.AbortController();
        timeout = win.setTimeout(() => controller.abort(), timeoutMs);
        const url = new URL('version.json', new URL(base, win.location.origin));
        url.searchParams.set('_check', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const response = await fetchVersion(url.href, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('invalid response');
        const release = await response.json();
        if (!release || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(release.version) ||
          !/^[a-f0-9]{32}$/.test(release.buildId) || !Number.isFinite(Date.parse(release.builtAt))) throw new Error('invalid release');
        if (stopped) return false;
        showRelease(release);
        status.textContent = latest ? '有新版本可更新' : '目前已是最新版本';
        return true;
      } catch {
        if (!stopped) status.textContent = latest ? '暫時無法重新檢查；先前已偵測到可更新版本' : '無法檢查更新，請稍後重試';
        return false;
      } finally {
        win.clearTimeout(timeout);
        controller = null;
        if (!stopped) checkButton.disabled = false;
      }
    })();
    // 分開清理，離線或同步拋錯時也不會留下已完成的 pending。
    void pending.finally(() => { pending = null; });
    return pending;
  }
  function requestReload() {
    if (!latest || stopped) return;
    if (isBusy()) { status.textContent = '正在處理資料，完成後再按更新'; return; }
    if (hasUnsavedChanges() && !win.confirm('尚有未儲存的內容。重新整理會遺失這些內容，建議先取消並暫存。仍要重新整理嗎？')) return;
    reload(latest.buildId);
  }
  const onCheck = () => void check();
  const onForeground = () => void check({ automatic: true });
  const onOnline = () => void check();
  checkButton.addEventListener('click', onCheck);
  reloadButton.addEventListener('click', requestReload);
  if (enabled) {
    doc.addEventListener('visibilitychange', onForeground);
    win.addEventListener('focus', onForeground);
    win.addEventListener('pageshow', onForeground);
    win.addEventListener('online', onOnline);
    timer = win.setInterval(onForeground, intervalMs);
    void check({ automatic: true });
  } else {
    checkButton.disabled = true;
    status.textContent = '開發模式，部署後啟用版本檢查';
  }
  return { check, destroy() {
    stopped = true; controller?.abort(); win.clearInterval(timer);
    checkButton.removeEventListener('click', onCheck); reloadButton.removeEventListener('click', requestReload);
    doc.removeEventListener('visibilitychange', onForeground); win.removeEventListener('focus', onForeground);
    win.removeEventListener('pageshow', onForeground); win.removeEventListener('online', onOnline);
  } };
}

// 基準保留在記憶體，不將填報或密碼寫入瀏覽器儲存空間。
export function createEditGuard(doc) {
  const groups = new Map();
  const value = el => el.type === 'checkbox' ? el.checked : el.value;
  return {
    capture(name, selector) { groups.set(name, [...doc.querySelectorAll(selector)].filter(el => !el.readOnly).map(el => [el, value(el)])); },
    hasChanges() { return [...groups.values()].some(fields => fields.some(([el, original]) => el.isConnected && value(el) !== original)); },
    reset() { groups.clear(); }
  };
}
