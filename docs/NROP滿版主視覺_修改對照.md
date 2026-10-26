# NROP 滿版主視覺：移除白圈並保留字樣

修改日期：2026-10-26。以下變更已套用於本機平台。

將圓形識別圖改為矩形醫院與資訊儀表板場景，圖片直接鋪滿首頁左側深藍色塊，以底部漸層銜接網站文字。新版保留原圖風格的白藍漸層 NROP 字樣與 O 內的心電圖；移除圓形外框、白色外緣、貼圖式邊框與光暈。頁首保留平台名稱文字，取消小型圓形圖章。

網站標題及簡短說明使用 HTML 文字，放在主視覺下方的深藍漸層區；英文平台名稱保留於頁首。手機版依螢幕寬度調整圖區高度。

## 檔案與驗證

- `assets/nrop-hospital-hero.png`：內建 image_gen 編修／合成，尺寸 1086 × 1448。
- `index.html`：主視覺改為左側色塊中的滿版背景圖片。
- `assets/theme.css`：滿版定位、底部漸層及手機版高度。
- `docs/NROP滿版主視覺_提示詞.txt`：最終製圖提示詞。

已檢視生成圖片並確認 NROP 拼字及 O 內心電圖，四角為深藍背景；已檢查圖片及 CSS 路徑、HTML id、CSS 結構，並比對 JavaScript 與修改前逐字一致。另以主視覺中觀察到的字樣範圍估算 5 組容器尺寸，確認字樣位於可見區域。此為程式與幾何檢查；瀏覽器工具限制 file:// 本機頁面，尚未實際操作瀏覽器驗證排版。

## 1. 頁首完整段落

修改前：

```html
    <div class="brand"><div class="brand-mark"><img src="./assets/nrop-brand-concept.png" width="48" height="48" alt="" aria-hidden="true"></div><div class="brand-copy"><div class="brand-title">護理即時動態平台 NROP</div><div class="brand-subtitle">Nursing Real-Time Operations Platform</div></div></div>
```

修改後：

```html
    <div class="brand"><div class="brand-copy"><div class="brand-title">護理即時動態平台 NROP</div><div class="brand-subtitle">Nursing Real-Time Operations Platform</div></div></div>
```

## 2. 首頁主視覺完整段落

修改前：

```html
      <div class="login-intro">
        <figure class="nrop-visual">
          <img src="./assets/nrop-brand-concept.png" width="1254" height="1254" alt="NROP 護理即時動態平台識別圖，結合醫院、資訊儀表板及青色心電圖意象" fetchpriority="high">
        </figure>
        <div class="intro-copy">
          <h1>護理即時動態平台</h1>
          <p class="intro-english">Nursing Real-Time Operations Platform</p>
          <p>整合各護理單位班別填報、床位動態與人力統計，即時掌握全院照護運作。</p>
        </div>
      </div>
```

修改後：

```html
      <div class="login-intro">
        <img class="intro-art" src="./assets/nrop-hospital-hero.png" width="1086" height="1448" alt="" aria-hidden="true" fetchpriority="high">
        <div class="intro-copy">
          <h1>護理即時動態平台</h1>
          <p>整合班別填報、床位動態與人力統計。</p>
        </div>
      </div>
```

## 3. 完整樣式檔

可將 `assets/theme.css` 整份內容替換為「修改後」。

修改前：

```css
:root {
  color-scheme: light;
  --navy: #062752;
  --blue: #0b63ce;
  --teal: #0865bb;
  --cyan: #39d9ef;
  --bg: #edf3fa;
  --card: #fff;
  --line: #c8d9ea;
  --input-line: #7892ad;
  --text: #162b41;
  --muted: #51677e;
  --warn: #b45309;
  --danger: #ba3b46;
  --ok: #19734b;
  --surface-soft: #e2f1fb;
  --surface-wash: #f0f5fa;
  --shadow: 0 10px 28px rgba(6, 39, 82, .09);
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif; }
[hidden], .hidden { display: none !important; }
button, input, select { font: inherit; }
button { touch-action: manipulation; }
button:focus-visible { outline: 3px solid var(--teal); outline-offset: 3px; }

/* Header and shared actions */
.topbar { min-height: 92px; padding: 14px 32px; background: linear-gradient(115deg, #041735, #082c5d 65%, #0c4778); color: #fff; border-bottom: 2px solid #20c7df; display: flex; align-items: center; justify-content: space-between; gap: 16px; box-shadow: 0 4px 20px rgba(6, 39, 82, .18); }
.brand { display: flex; align-items: center; gap: 13px; font-weight: 800; letter-spacing: .04em; }
.brand-mark { flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%; background: #041735; border: 1px solid rgba(89, 217, 244, .55); display: grid; place-items: center; overflow: hidden; box-shadow: 0 0 16px rgba(57, 217, 239, .14); }
.brand-mark img { display: block; width: 100%; height: 100%; object-fit: contain; border-radius: 50%; }
.brand-copy { display: flex; flex-direction: column; gap: 4px; }
.brand-title { font-size: 24px; line-height: 1.2; }
.brand-subtitle { font-size: 12px; font-weight: 500; letter-spacing: .02em; color: #b6d7ef; }
.top-actions { display: flex; align-items: center; gap: 12px; }
.user-chip { padding: 8px 13px; background: #ffffff16; color: #fff; border: 1px solid #ffffff25; border-radius: 999px; font-size: 14px; }
.btn { border: 0; border-radius: 10px; padding: 10px 17px; cursor: pointer; font-weight: 700; transition: background .15s, box-shadow .15s, transform .15s; }
.btn:hover { transform: translateY(-1px); }
.btn-primary { background: linear-gradient(115deg, #0061bf, #0756ae); color: #fff; box-shadow: 0 4px 14px rgba(11, 99, 206, .24); }
.btn-primary:hover { background: linear-gradient(115deg, #0754a2, #064891); }
.btn-soft { background: var(--surface-soft); color: #075a9d; }
.btn-soft:hover { background: #d0e7f8; }
.btn-ghost { background: transparent; color: inherit; border: 1px solid currentColor; }
.btn-danger { background: #fff0f0; color: var(--danger); }
.wrap { max-width: 1440px; margin: auto; padding: 28px; }

/* Login welcome panel */
.login-wrap { min-height: calc(100vh - 92px); display: grid; place-items: center; padding: 32px 24px; background: radial-gradient(ellipse at 15% 20%, rgba(11, 99, 206, .07), transparent 55%), var(--bg); }
.login-card { width: min(1080px, 100%); min-height: 620px; display: grid; grid-template-columns: 1.12fr 1fr; background: #fff; border: 1px solid #bdcfe4; border-radius: 26px; overflow: hidden; box-shadow: 0 24px 70px rgba(6, 39, 82, .18); }
.login-intro { position: relative; isolation: isolate; overflow: hidden; padding: 32px; background: radial-gradient(ellipse at 40% 25%, rgba(4, 124, 229, .25), transparent 65%), linear-gradient(150deg, #03152f, #062e60); color: #fff; border-right: 1px solid #104a77; display: flex; flex-direction: column; gap: 22px; }
.login-intro::before { content: ""; position: absolute; inset: 0; pointer-events: none; background-image: linear-gradient(rgba(57, 217, 239, .04) 1px, transparent 1px), linear-gradient(90deg, rgba(57, 217, 239, .04) 1px, transparent 1px); background-size: 40px 40px; z-index: 0; }
.nrop-visual { position: relative; z-index: 1; flex: 1; width: 100%; display: grid; place-items: center; margin: 0; }
.nrop-visual img { display: block; width: min(100%, 400px); height: auto; aspect-ratio: 1; object-fit: contain; border-radius: 50%; border: 1px solid rgba(57, 217, 239, .25); box-shadow: 0 0 38px rgba(11, 149, 224, .20); }
.intro-copy { position: relative; z-index: 1; text-align: center; }
.login-intro h1 { font-size: 28px; line-height: 1.4; margin: 0 0 7px; letter-spacing: .04em; }
.login-intro p { line-height: 1.85; color: #d4e8f7; margin: 0; font-size: 14px; }
.login-intro .intro-english { font-size: 12px; color: #8ee9f5; letter-spacing: .025em; margin-bottom: 12px; }
.login-form { padding: 44px; display: flex; flex-direction: column; justify-content: center; }
.login-form h2 { margin: 0 0 8px; color: var(--navy); font-size: 25px; }
.login-form > p { color: var(--muted); margin: 0 0 28px; line-height: 1.7; }
.field { display: flex; flex-direction: column; gap: 7px; margin-bottom: 18px; }
.field label { font-size: 14px; color: #42545f; font-weight: 700; }
.field input, .field select, .number-field input { width: 100%; border: 1px solid var(--input-line); border-radius: 10px; padding: 12px 13px; background: #fff; color: var(--text); outline: none; }
.field input:focus, .field select:focus, .number-field input:focus, .filterbar input:focus, .filterbar select:focus { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(11, 99, 206, .15); outline: none; }
.login-form .btn { width: 100%; padding: 13px; }
.demo-note { font-size: 13px; line-height: 1.7; color: var(--muted); background: var(--surface-wash); padding: 12px 14px; border: 1px solid #e5ecef; border-radius: 10px; margin-top: 16px; }

/* Pages, cards and forms */
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; }
.page-head h1 { font-size: 27px; margin: 0 0 6px; color: var(--navy); }
.page-head p { margin: 0; color: var(--muted); line-height: 1.7; }
.tabs { display: flex; flex-wrap: wrap; background: #dce8f4; border: 1px solid #b7d0e5; padding: 4px; border-radius: 12px; gap: 3px; }
.tab { border: 0; background: transparent; padding: 9px 16px; border-radius: 9px; cursor: pointer; font-weight: 700; color: #526873; }
.tab.active { background: #fff; color: #075da8; box-shadow: 0 2px 8px rgba(6, 39, 82, .12), inset 0 -2px 0 #18bdd7; }
.summary-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 20px; }
.metric { background: var(--card); border: 1px solid var(--line); border-top: 3px solid #a3ddeb; border-radius: 15px; padding: 17px; box-shadow: var(--shadow); }
.metric .label { font-size: 13px; color: var(--muted); margin-bottom: 8px; }
.metric .value { font-size: 28px; font-weight: 850; color: var(--navy); }
.metric .unit { font-size: 13px; color: var(--muted); margin-left: 3px; }
.metric.warning { background: var(--card); border-color: var(--line); border-top-color: #e0ae6d; }
.metric.warning .value { color: var(--warn); }
.grid-2 { display: grid; grid-template-columns: 1.4fr .9fr; gap: 20px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
.card-head { padding: 18px 20px; background: linear-gradient(90deg, #f0f7fc, #fff); border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.card-head h2 { font-size: 17px; margin: 0; color: var(--navy); display: flex; align-items: center; gap: 8px; }
.card-head h2::before { content: ""; flex-shrink: 0; width: 3px; height: 16px; border-radius: 2px; background: #12accd; }
.card-body { padding: 20px; }
.form-context { display: grid; grid-template-columns: 1.3fr 1fr 1fr 1fr; gap: 14px; margin-bottom: 20px; }
.context-box { background: #f0f5fa; border: 1px solid var(--line); padding: 13px 15px; border-radius: 11px; text-align: center; }
.context-box small { display: block; color: var(--muted); margin-bottom: 5px; }
.context-box strong { font-size: 17px; color: var(--navy); }
.context-box input, .context-box select { color: var(--text); }
.input-section { padding: 20px 0; border-top: 1px solid var(--line); }
.input-section:first-of-type { border-top: 0; padding-top: 0; }
.input-section h3 { font-size: 15px; margin: 0 0 14px; color: var(--navy); }
.entry-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 13px; }
.number-field label { font-size: 13px; color: var(--muted); font-weight: 700; display: block; margin-bottom: 6px; text-align: center; }
.number-field input { padding: 12px; font-weight: 700; }
.number-field input:read-only { background: #edf2f7; color: #3e5974; }
input[type="number"] { text-align: center; }
.calc-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.calc { border-radius: 12px; background: #eaf5fd; padding: 15px; border: 1px solid #c4dff0; }
.calc small { display: block; color: #385c78; margin-bottom: 4px; }
.calc strong { font-size: 23px; color: #075a9d; }
.calc.over { background: #fff3e8; border-color: #f2d1ad; }
.calc.over strong { color: var(--warn); }
.actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 20px; }
.status { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 750; }
.status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.status.done { background: #e9f7ef; color: var(--ok); }
.status.draft { background: #fff5df; color: var(--warn); }
.status.empty { background: #edf1f3; color: #71808a; }
.notice { padding: 13px 15px; border-radius: 10px; background: #fff7e6; color: #8a5a00; font-size: 14px; line-height: 1.7; margin-bottom: 16px; }
.formula { font-size: 13px; color: var(--muted); line-height: 1.8; background: #f3f7fb; padding: 13px; border: 1px solid #dae5f0; border-radius: 10px; }
.side-list { display: flex; flex-direction: column; gap: 11px; }
.side-item { border: 1px solid var(--line); border-radius: 11px; padding: 13px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.side-item b { display: block; }
.side-item small { color: var(--muted); }

/* Tables and dashboard charts */
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { padding: 13px 12px; text-align: center; border-bottom: 1px solid var(--line); white-space: nowrap; }
th { font-size: 12px; color: #3e5974; background: #eaf2f9; }
tbody tr:nth-child(even) { background: #fff; }
tbody tr:hover { background: #f6f9fa; }
td.num { text-align: center; font-variant-numeric: tabular-nums; }
.rate { width: 92px; height: 8px; background: #deebf5; border-radius: 99px; overflow: hidden; display: inline-block; margin-right: 8px; }
.rate i { display: block; height: 100%; background: var(--teal); border-radius: 99px; }
.rate.over i { background: var(--danger); }
.table-wrap { overflow: auto; }
.filterbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.filterbar input, .filterbar select { border: 1px solid var(--input-line); padding: 9px 11px; border-radius: 9px; background: #fff; color: var(--text); }
.dashboard-section { margin-top: 20px; }
.chart { display: flex; align-items: flex-end; gap: 15px; height: 230px; padding: 20px 12px 5px; }
.bar-col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 7px; min-width: 32px; }
.bar { width: 70%; max-width: 38px; background: linear-gradient(#34d6ec, #0a65ca); border-radius: 7px 7px 2px 2px; min-height: 3px; position: relative; }
.bar.over { background: linear-gradient(#d76d58, #b9434b); }
.bar-col span { font-size: 11px; color: var(--muted); }
.bar-col b { font-size: 11px; }
.dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.empty-state { text-align: center; color: var(--muted); padding: 34px; }
.footnote { text-align: center; color: var(--muted); font-size: 12px; padding: 26px; }
.toast { position: fixed; right: 24px; bottom: 24px; background: var(--navy); color: #fff; padding: 13px 18px; border-radius: 11px; box-shadow: 0 10px 30px rgba(23, 50, 77, .18); z-index: 50; }
.required { color: var(--danger); }
.subtabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; border-bottom: 1px solid var(--line); padding-bottom: 10px; }
.subtab { border: 0; background: transparent; color: var(--muted); padding: 10px 15px; border-radius: 9px; cursor: pointer; font-weight: 800; }
.subtab.active { background: #083d73; color: #fff; }
#shiftPanel > .summary-grid { grid-template-columns: repeat(7, minmax(0, 1fr)); }

@media (max-width: 1000px) {
  .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  #shiftPanel > .summary-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .grid-2, .dashboard-grid { grid-template-columns: 1fr; }
  .form-context { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .login-intro, .login-form { padding: 32px; }
}

@media (max-width: 760px) {
  .login-card { grid-template-columns: 1fr; min-height: 0; max-width: 540px; }
  .login-intro { padding: 28px; border-right: 0; border-bottom: 1px solid #104a77; gap: 20px; }
  .login-intro h1 { font-size: 26px; }
  .nrop-visual { width: min(100%, 280px); margin: 0 auto; flex: none; }
  .login-form { padding: 32px 28px; }
}

@media (max-width: 680px) {
  .topbar { min-height: 80px; padding: 12px 16px; }
  .brand-title { font-size: 18px; }
  .brand-subtitle { font-size: 10px; }
  .topbar .brand-mark { width: 40px; height: 40px; }
  .user-chip { display: none; }
  .wrap { padding: 18px; }
  .login-wrap { min-height: calc(100vh - 80px); padding: 20px 16px; }
  .summary-grid, #shiftPanel > .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .entry-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .calc-strip { grid-template-columns: 1fr; }
  .page-head { align-items: flex-start; flex-direction: column; }
  .form-context { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 380px) {
  .brand { gap: 8px; }
  .brand-title { font-size: 16px; }
  .brand-subtitle { font-size: 9px; }
  .login-intro, .login-form { padding: 24px; }
  .login-intro h1 { font-size: 25px; }
  .context-box { padding: 11px 9px; }
  .top-actions .btn { padding: 8px 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .btn { transition: none; }
  .btn:hover { transform: none; }
}
```

修改後：

```css
:root {
  color-scheme: light;
  --navy: #062752;
  --blue: #0b63ce;
  --teal: #0865bb;
  --cyan: #39d9ef;
  --bg: #edf3fa;
  --card: #fff;
  --line: #c8d9ea;
  --input-line: #7892ad;
  --text: #162b41;
  --muted: #51677e;
  --warn: #b45309;
  --danger: #ba3b46;
  --ok: #19734b;
  --surface-soft: #e2f1fb;
  --surface-wash: #f0f5fa;
  --shadow: 0 10px 28px rgba(6, 39, 82, .09);
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif; }
[hidden], .hidden { display: none !important; }
button, input, select { font: inherit; }
button { touch-action: manipulation; }
button:focus-visible { outline: 3px solid var(--teal); outline-offset: 3px; }

/* Header and shared actions */
.topbar { min-height: 92px; padding: 14px 32px; background: linear-gradient(115deg, #041735, #082c5d 65%, #0c4778); color: #fff; border-bottom: 2px solid #20c7df; display: flex; align-items: center; justify-content: space-between; gap: 16px; box-shadow: 0 4px 20px rgba(6, 39, 82, .18); }
.brand { display: flex; align-items: center; gap: 13px; font-weight: 800; letter-spacing: .04em; }
.brand-copy { display: flex; flex-direction: column; gap: 4px; }
.brand-title { font-size: 24px; line-height: 1.2; }
.brand-subtitle { font-size: 12px; font-weight: 500; letter-spacing: .02em; color: #b6d7ef; }
.top-actions { display: flex; align-items: center; gap: 12px; }
.user-chip { padding: 8px 13px; background: #ffffff16; color: #fff; border: 1px solid #ffffff25; border-radius: 999px; font-size: 14px; }
.btn { border: 0; border-radius: 10px; padding: 10px 17px; cursor: pointer; font-weight: 700; transition: background .15s, box-shadow .15s, transform .15s; }
.btn:hover { transform: translateY(-1px); }
.btn-primary { background: linear-gradient(115deg, #0061bf, #0756ae); color: #fff; box-shadow: 0 4px 14px rgba(11, 99, 206, .24); }
.btn-primary:hover { background: linear-gradient(115deg, #0754a2, #064891); }
.btn-soft { background: var(--surface-soft); color: #075a9d; }
.btn-soft:hover { background: #d0e7f8; }
.btn-ghost { background: transparent; color: inherit; border: 1px solid currentColor; }
.btn-danger { background: #fff0f0; color: var(--danger); }
.wrap { max-width: 1440px; margin: auto; padding: 28px; }

/* Login welcome panel */
.login-wrap { min-height: calc(100vh - 92px); display: grid; place-items: center; padding: 32px 24px; background: radial-gradient(ellipse at 15% 20%, rgba(11, 99, 206, .07), transparent 55%), var(--bg); }
.login-card { width: min(1080px, 100%); min-height: 620px; display: grid; grid-template-columns: 1.12fr 1fr; background: #fff; border: 1px solid #bdcfe4; border-radius: 26px; overflow: hidden; box-shadow: 0 24px 70px rgba(6, 39, 82, .18); }
.login-intro { position: relative; isolation: isolate; overflow: hidden; min-height: 620px; padding: 40px; background: #03152f; color: #fff; border-right: 1px solid #104a77; display: flex; flex-direction: column; justify-content: flex-end; }
.login-intro .intro-art { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 100%; pointer-events: none; }
.login-intro::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(3, 21, 47, .02) 65%, rgba(3, 21, 47, .12) 72%, rgba(3, 21, 47, .94) 84%, #03152f 100%); z-index: 1; }
.intro-copy { position: relative; z-index: 2; text-align: left; }
.login-intro h1 { font-size: 28px; line-height: 1.4; margin: 0 0 7px; letter-spacing: .04em; }
.login-intro p { line-height: 1.85; color: #d4e8f7; margin: 0; font-size: 14px; }
.login-form { padding: 44px; display: flex; flex-direction: column; justify-content: center; }
.login-form h2 { margin: 0 0 8px; color: var(--navy); font-size: 25px; }
.login-form > p { color: var(--muted); margin: 0 0 28px; line-height: 1.7; }
.field { display: flex; flex-direction: column; gap: 7px; margin-bottom: 18px; }
.field label { font-size: 14px; color: #42545f; font-weight: 700; }
.field input, .field select, .number-field input { width: 100%; border: 1px solid var(--input-line); border-radius: 10px; padding: 12px 13px; background: #fff; color: var(--text); outline: none; }
.field input:focus, .field select:focus, .number-field input:focus, .filterbar input:focus, .filterbar select:focus { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(11, 99, 206, .15); outline: none; }
.login-form .btn { width: 100%; padding: 13px; }
.demo-note { font-size: 13px; line-height: 1.7; color: var(--muted); background: var(--surface-wash); padding: 12px 14px; border: 1px solid #e5ecef; border-radius: 10px; margin-top: 16px; }

/* Pages, cards and forms */
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; }
.page-head h1 { font-size: 27px; margin: 0 0 6px; color: var(--navy); }
.page-head p { margin: 0; color: var(--muted); line-height: 1.7; }
.tabs { display: flex; flex-wrap: wrap; background: #dce8f4; border: 1px solid #b7d0e5; padding: 4px; border-radius: 12px; gap: 3px; }
.tab { border: 0; background: transparent; padding: 9px 16px; border-radius: 9px; cursor: pointer; font-weight: 700; color: #526873; }
.tab.active { background: #fff; color: #075da8; box-shadow: 0 2px 8px rgba(6, 39, 82, .12), inset 0 -2px 0 #18bdd7; }
.summary-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 20px; }
.metric { background: var(--card); border: 1px solid var(--line); border-top: 3px solid #a3ddeb; border-radius: 15px; padding: 17px; box-shadow: var(--shadow); }
.metric .label { font-size: 13px; color: var(--muted); margin-bottom: 8px; }
.metric .value { font-size: 28px; font-weight: 850; color: var(--navy); }
.metric .unit { font-size: 13px; color: var(--muted); margin-left: 3px; }
.metric.warning { background: var(--card); border-color: var(--line); border-top-color: #e0ae6d; }
.metric.warning .value { color: var(--warn); }
.grid-2 { display: grid; grid-template-columns: 1.4fr .9fr; gap: 20px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
.card-head { padding: 18px 20px; background: linear-gradient(90deg, #f0f7fc, #fff); border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.card-head h2 { font-size: 17px; margin: 0; color: var(--navy); display: flex; align-items: center; gap: 8px; }
.card-head h2::before { content: ""; flex-shrink: 0; width: 3px; height: 16px; border-radius: 2px; background: #12accd; }
.card-body { padding: 20px; }
.form-context { display: grid; grid-template-columns: 1.3fr 1fr 1fr 1fr; gap: 14px; margin-bottom: 20px; }
.context-box { background: #f0f5fa; border: 1px solid var(--line); padding: 13px 15px; border-radius: 11px; text-align: center; }
.context-box small { display: block; color: var(--muted); margin-bottom: 5px; }
.context-box strong { font-size: 17px; color: var(--navy); }
.context-box input, .context-box select { color: var(--text); }
.input-section { padding: 20px 0; border-top: 1px solid var(--line); }
.input-section:first-of-type { border-top: 0; padding-top: 0; }
.input-section h3 { font-size: 15px; margin: 0 0 14px; color: var(--navy); }
.entry-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 13px; }
.number-field label { font-size: 13px; color: var(--muted); font-weight: 700; display: block; margin-bottom: 6px; text-align: center; }
.number-field input { padding: 12px; font-weight: 700; }
.number-field input:read-only { background: #edf2f7; color: #3e5974; }
input[type="number"] { text-align: center; }
.calc-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.calc { border-radius: 12px; background: #eaf5fd; padding: 15px; border: 1px solid #c4dff0; }
.calc small { display: block; color: #385c78; margin-bottom: 4px; }
.calc strong { font-size: 23px; color: #075a9d; }
.calc.over { background: #fff3e8; border-color: #f2d1ad; }
.calc.over strong { color: var(--warn); }
.actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 20px; }
.status { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 750; }
.status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.status.done { background: #e9f7ef; color: var(--ok); }
.status.draft { background: #fff5df; color: var(--warn); }
.status.empty { background: #edf1f3; color: #71808a; }
.notice { padding: 13px 15px; border-radius: 10px; background: #fff7e6; color: #8a5a00; font-size: 14px; line-height: 1.7; margin-bottom: 16px; }
.formula { font-size: 13px; color: var(--muted); line-height: 1.8; background: #f3f7fb; padding: 13px; border: 1px solid #dae5f0; border-radius: 10px; }
.side-list { display: flex; flex-direction: column; gap: 11px; }
.side-item { border: 1px solid var(--line); border-radius: 11px; padding: 13px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.side-item b { display: block; }
.side-item small { color: var(--muted); }

/* Tables and dashboard charts */
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { padding: 13px 12px; text-align: center; border-bottom: 1px solid var(--line); white-space: nowrap; }
th { font-size: 12px; color: #3e5974; background: #eaf2f9; }
tbody tr:nth-child(even) { background: #fff; }
tbody tr:hover { background: #f6f9fa; }
td.num { text-align: center; font-variant-numeric: tabular-nums; }
.rate { width: 92px; height: 8px; background: #deebf5; border-radius: 99px; overflow: hidden; display: inline-block; margin-right: 8px; }
.rate i { display: block; height: 100%; background: var(--teal); border-radius: 99px; }
.rate.over i { background: var(--danger); }
.table-wrap { overflow: auto; }
.filterbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.filterbar input, .filterbar select { border: 1px solid var(--input-line); padding: 9px 11px; border-radius: 9px; background: #fff; color: var(--text); }
.dashboard-section { margin-top: 20px; }
.chart { display: flex; align-items: flex-end; gap: 15px; height: 230px; padding: 20px 12px 5px; }
.bar-col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 7px; min-width: 32px; }
.bar { width: 70%; max-width: 38px; background: linear-gradient(#34d6ec, #0a65ca); border-radius: 7px 7px 2px 2px; min-height: 3px; position: relative; }
.bar.over { background: linear-gradient(#d76d58, #b9434b); }
.bar-col span { font-size: 11px; color: var(--muted); }
.bar-col b { font-size: 11px; }
.dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.empty-state { text-align: center; color: var(--muted); padding: 34px; }
.footnote { text-align: center; color: var(--muted); font-size: 12px; padding: 26px; }
.toast { position: fixed; right: 24px; bottom: 24px; background: var(--navy); color: #fff; padding: 13px 18px; border-radius: 11px; box-shadow: 0 10px 30px rgba(23, 50, 77, .18); z-index: 50; }
.required { color: var(--danger); }
.subtabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; border-bottom: 1px solid var(--line); padding-bottom: 10px; }
.subtab { border: 0; background: transparent; color: var(--muted); padding: 10px 15px; border-radius: 9px; cursor: pointer; font-weight: 800; }
.subtab.active { background: #083d73; color: #fff; }
#shiftPanel > .summary-grid { grid-template-columns: repeat(7, minmax(0, 1fr)); }

@media (max-width: 1000px) {
  .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  #shiftPanel > .summary-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .grid-2, .dashboard-grid { grid-template-columns: 1fr; }
  .form-context { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .login-intro, .login-form { padding: 32px; }
}

@media (max-width: 760px) {
  .login-card { grid-template-columns: 1fr; min-height: 0; max-width: 540px; }
  .login-intro { min-height: clamp(440px, 110vw, 600px); padding: 28px; border-right: 0; border-bottom: 1px solid #104a77; }
  .login-intro h1 { font-size: 26px; }
  .login-form { padding: 32px 28px; }
}

@media (max-width: 680px) {
  .topbar { min-height: 80px; padding: 12px 16px; }
  .brand-title { font-size: 18px; }
  .brand-subtitle { font-size: 10px; }
  .user-chip { display: none; }
  .wrap { padding: 18px; }
  .login-wrap { min-height: calc(100vh - 80px); padding: 20px 16px; }
  .summary-grid, #shiftPanel > .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .entry-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .calc-strip { grid-template-columns: 1fr; }
  .page-head { align-items: flex-start; flex-direction: column; }
  .form-context { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 380px) {
  .brand { gap: 8px; }
  .brand-title { font-size: 16px; }
  .brand-subtitle { font-size: 9px; }
  .login-intro, .login-form { padding: 24px; }
  .login-intro h1 { font-size: 25px; }
  .context-box { padding: 11px 9px; }
  .top-actions .btn { padding: 8px 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .btn { transition: none; }
  .btn:hover { transform: none; }
}
```

## 4. 最終製圖提示詞

```text
Generation method: built-in image_gen, edit/compositing
Final asset: assets/nrop-hospital-hero.png

Use case: compositing
Asset type: full-bleed rectangular nursing operations website hero illustration, portrait 3:4.
Input image 1: EDIT TARGET — the rectangular blue hospital and floating medical-data dashboard scene. Preserve its scene, composition, style, colors, clean full-bleed rectangular edges, and the absence of any circular frame.
Input image 2: supporting insert / exact wordmark design reference — the original circular NROP artwork. Use ONLY its wide NROP wordmark lettering as the reference; do not bring over the circular badge, white exterior, or Chinese subtitle.
Edit request: integrate the original large NROP wordmark from image 2 into the lower-middle of image 1, centered at roughly 62 percent of the canvas height. Keep it about 80 percent of the canvas width, with generous margin on both sides. It must feel naturally part of the same blue hero illustration, without any surrounding white panel, circle, border, logo tile or sticker.
Preserve the original NROP letter design very closely: bold geometric N R O P, white-to-icy-blue gradients, vivid cyan accents; especially the O formed by the segmented cyan circular ring containing the glowing ECG trace. Exact lettering: NROP. All four letters clear, fully inside the frame, no altered spelling. The NROP wordmark itself stays bright and legible.
Keep the hospital, medical cross, ECG dashboard, charts and cyan flowing light paths visually prominent above the wordmark. Continue the scene seamlessly behind and around the lettering. Keep the bottom 20 percent of the entire canvas mostly uncluttered deep navy #03152f so live HTML title and description can sit there later.
Constraints: modify only what is necessary to add this integrated original-style NROP lettering. No enclosing circular silhouette or white outer ring. No Chinese text, no other words or numbers, no inset frame, no surrounding mockup, no new characters, no form controls. Opaque rectangular full-bleed image.
```
