# NROP 品牌視覺整合：修改前後對照

修改日期：2026-10-26。以下變更已套用於本機平台。

直接使用提供的 NROP 藍色識別圖作為首頁主視覺及頁首小型識別。圖片依原始比例以圓形呈現，保留圖中文字及儀表板構圖；首頁左側使用深藍背景、青色點綴與低對比網格，右側登入表單使用白底。主要操作、圖表與選取狀態延伸藍色及青色，填報與統計內容維持明亮背景。

## 檔案

- `index.html`：首頁主視覺及頁首識別。
- `assets/theme.css`：整合深藍、亮藍與青色的樣式。
- `assets/nrop-brand-concept.png`：提供的原始圖片之本機副本，尺寸 1254 × 1254。圖片檔案與原檔 SHA-256 一致。

## 驗證

已確認 JavaScript 與修改前逐字相同，圖片及樣式路徑有效，HTML id 沒有重複，CSS 區塊結構完整；12 組主要文字及背景色的計算對比達 4.5:1 以上，輸入框邊線與白底對比達 3:1 以上。

圖片中的儀表板數字屬識別圖內容；平台統計仍由既有填報資料計算。瀏覽器工具限制 file:// 本機頁面，本次尚未進行實際瀏覽器視覺驗證。

## 1. 頁首識別

修改前：

```html
    <div class="brand"><div class="brand-mark">護</div><div class="brand-copy"><div class="brand-title">護理即時動態平台 NROP</div><div class="brand-subtitle">Nursing Real-Time Operations Platform</div></div></div>
```

修改後：

```html
    <div class="brand"><div class="brand-mark"><img src="./assets/nrop-brand-concept.png" width="48" height="48" alt="" aria-hidden="true"></div><div class="brand-copy"><div class="brand-title">護理即時動態平台 NROP</div><div class="brand-subtitle">Nursing Real-Time Operations Platform</div></div></div>
```

## 2. 首頁介紹區（完整段落）

修改前：

```html
      <div class="login-intro">
        <div class="brand-mark">護</div>
        <h1>護理即時動態平台<br><span style="font-size:.65em;font-weight:650">NROP</span></h1>
        <p><b>Nursing Real-Time Operations Platform</b><br>整合各護理單位班別填報、床位動態與人力統計，即時掌握全院照護運作。</p>
        <figure class="nursing-visual">
          <img src="./assets/nursing-care-rose.png" width="1448" height="1086" alt="護理人員手持平板，搭配愛心與病床圖示的粉色立體插畫">
        </figure>
      </div>
```

修改後：

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

## 3. 完整樣式檔

可將 `assets/theme.css` 整份內容替換為「修改後」。

修改前：

```css
:root {
  color-scheme: light;
  --navy: #17324d;
  --blue: #236b8e;
  --teal: #17857b;
  --bg: #f3f7f8;
  --card: #fff;
  --line: #d9e3e7;
  --input-line: #d9e3e7;
  --text: #17232d;
  --muted: #657680;
  --warn: #b45309;
  --danger: #ba3b46;
  --ok: #19734b;
  --surface-soft: #e7f2f2;
  --surface-wash: #f4f7f8;
  --shadow: 0 10px 28px rgba(24,50,75,.08);
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif; }
[hidden], .hidden { display: none !important; }
button, input, select { font: inherit; }
button { touch-action: manipulation; }
button:focus-visible { outline: 3px solid var(--teal); outline-offset: 3px; }

/* Header and shared actions */
.topbar { min-height: 92px; padding: 14px 32px; background: var(--navy); color: #fff; border-bottom: 1px solid var(--navy); display: flex; align-items: center; justify-content: space-between; gap: 16px; box-shadow: 0 2px 12px #17324d30; }
.brand { display: flex; align-items: center; gap: 13px; font-weight: 800; letter-spacing: .04em; }
.brand-mark { flex-shrink: 0; width: 44px; height: 44px; border-radius: 14px; background: #fff; color: var(--navy); border: 1px solid #d9e3e7; display: grid; place-items: center; font-size: 23px; box-shadow: 0 4px 10px rgba(23, 50, 77, .04); }
.topbar .brand-mark { width: 46px; height: 46px; background: #fff; border-color: #fff; }
.brand-copy { display: flex; flex-direction: column; gap: 4px; }
.brand-title { font-size: 24px; line-height: 1.2; }
.brand-subtitle { font-size: 12px; font-weight: 500; letter-spacing: .02em; color: #cfe1e9; }
.top-actions { display: flex; align-items: center; gap: 12px; }
.user-chip { padding: 8px 13px; background: #ffffff16; color: #fff; border: 1px solid #ffffff25; border-radius: 999px; font-size: 14px; }
.btn { border: 0; border-radius: 10px; padding: 10px 17px; cursor: pointer; font-weight: 700; transition: background .15s, box-shadow .15s, transform .15s; }
.btn:hover { transform: translateY(-1px); }
.btn-primary { background: var(--teal); color: #fff; box-shadow: 0 4px 12px rgba(23, 133, 123, .16); }
.btn-primary:hover { background: #126e65; }
.btn-soft { background: var(--surface-soft); color: #17675f; }
.btn-soft:hover { background: #d5e9e7; }
.btn-ghost { background: transparent; color: inherit; border: 1px solid currentColor; }
.btn-danger { background: #fff0f0; color: var(--danger); }
.wrap { max-width: 1440px; margin: auto; padding: 28px; }

/* Login welcome panel */
.login-wrap { min-height: calc(100vh - 92px); display: grid; place-items: center; padding: 32px 24px; }
.login-card { width: min(1040px, 100%); min-height: 620px; display: grid; grid-template-columns: 1.06fr 1fr; background: #fff; border: 1px solid var(--line); border-radius: 26px; overflow: hidden; box-shadow: 0 24px 70px rgba(23, 50, 77, .14); }
.login-intro { padding: 40px; background: linear-gradient(145deg, #17324d, #236b8e); color: #fff; border-right: 1px solid #d9e3e7; display: flex; flex-direction: column; }
.login-intro h1 { font-size: 32px; line-height: 1.4; margin: 18px 0 12px; letter-spacing: .02em; }
.login-intro p { line-height: 1.85; color: #d9ebf2; margin: 0; }
.login-intro p b { color: inherit; font-size: 14px; }
.nursing-visual { margin: auto 0 0; padding-top: 24px; }
.nursing-visual img { display: block; width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: contain; border: 1px solid #d9e3e7; border-radius: 20px; box-shadow: 0 8px 20px rgba(23, 50, 77, .10); }
.login-form { padding: 44px; display: flex; flex-direction: column; justify-content: center; }
.login-form h2 { margin: 0 0 8px; color: var(--navy); font-size: 25px; }
.login-form > p { color: var(--muted); margin: 0 0 28px; line-height: 1.7; }
.field { display: flex; flex-direction: column; gap: 7px; margin-bottom: 18px; }
.field label { font-size: 14px; color: #42545f; font-weight: 700; }
.field input, .field select, .number-field input { width: 100%; border: 1px solid var(--input-line); border-radius: 10px; padding: 12px 13px; background: #fff; color: var(--text); outline: none; }
.field input:focus, .field select:focus, .number-field input:focus, .filterbar input:focus, .filterbar select:focus { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(23, 133, 123, .15); outline: none; }
.login-form .btn { width: 100%; padding: 13px; }
.demo-note { font-size: 13px; line-height: 1.7; color: var(--muted); background: var(--surface-wash); padding: 12px 14px; border: 1px solid #e5ecef; border-radius: 10px; margin-top: 16px; }

/* Pages, cards and forms */
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; }
.page-head h1 { font-size: 27px; margin: 0 0 6px; color: var(--navy); }
.page-head p { margin: 0; color: var(--muted); line-height: 1.7; }
.tabs { display: flex; flex-wrap: wrap; background: #e4ecef; border: 1px solid var(--line); padding: 4px; border-radius: 12px; gap: 3px; }
.tab { border: 0; background: transparent; padding: 9px 16px; border-radius: 9px; cursor: pointer; font-weight: 700; color: #526873; }
.tab.active { background: #fff; color: var(--navy); box-shadow: 0 2px 8px rgba(23, 50, 77, .16); }
.summary-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 20px; }
.metric { background: var(--card); border: 1px solid var(--line); border-radius: 15px; padding: 17px; box-shadow: var(--shadow); }
.metric .label { font-size: 13px; color: var(--muted); margin-bottom: 8px; }
.metric .value { font-size: 28px; font-weight: 850; color: var(--navy); }
.metric .unit { font-size: 13px; color: var(--muted); margin-left: 3px; }
.metric.warning { background: var(--card); border-color: var(--line); }
.metric.warning .value { color: var(--warn); }
.grid-2 { display: grid; grid-template-columns: 1.4fr .9fr; gap: 20px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
.card-head { padding: 18px 20px; background: #fff; border-bottom: 1px solid #e5ecef; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.card-head h2 { font-size: 17px; margin: 0; color: var(--navy); }
.card-body { padding: 20px; }
.form-context { display: grid; grid-template-columns: 1.3fr 1fr 1fr 1fr; gap: 14px; margin-bottom: 20px; }
.context-box { background: #f6f9fa; border: 1px solid var(--line); padding: 13px 15px; border-radius: 11px; text-align: center; }
.context-box small { display: block; color: var(--muted); margin-bottom: 5px; }
.context-box strong { font-size: 17px; color: var(--navy); }
.context-box input, .context-box select { color: var(--text); }
.input-section { padding: 20px 0; border-top: 1px solid var(--line); }
.input-section:first-of-type { border-top: 0; padding-top: 0; }
.input-section h3 { font-size: 15px; margin: 0 0 14px; color: var(--navy); }
.entry-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 13px; }
.number-field label { font-size: 13px; color: var(--muted); font-weight: 700; display: block; margin-bottom: 6px; text-align: center; }
.number-field input { padding: 12px; font-weight: 700; }
.number-field input:read-only { background: #f4f7f8; color: #42545f; }
input[type="number"] { text-align: center; }
.calc-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.calc { border-radius: 12px; background: #edf7f5; padding: 15px; border: 1px solid #cde7e2; }
.calc small { display: block; color: #4b6d68; margin-bottom: 4px; }
.calc strong { font-size: 23px; color: #126b62; }
.calc.over { background: #fff3e8; border-color: #f2d1ad; }
.calc.over strong { color: var(--warn); }
.actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 20px; }
.status { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 750; }
.status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.status.done { background: #e9f7ef; color: var(--ok); }
.status.draft { background: #fff5df; color: var(--warn); }
.status.empty { background: #edf1f3; color: #71808a; }
.notice { padding: 13px 15px; border-radius: 10px; background: #fff7e6; color: #8a5a00; font-size: 14px; line-height: 1.7; margin-bottom: 16px; }
.formula { font-size: 13px; color: var(--muted); line-height: 1.8; background: #f7fafb; padding: 13px; border: 1px solid #e5ecef; border-radius: 10px; }
.side-list { display: flex; flex-direction: column; gap: 11px; }
.side-item { border: 1px solid var(--line); border-radius: 11px; padding: 13px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.side-item b { display: block; }
.side-item small { color: var(--muted); }

/* Tables and dashboard charts */
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { padding: 13px 12px; text-align: center; border-bottom: 1px solid var(--line); white-space: nowrap; }
th { font-size: 12px; color: #60727d; background: #f7fafb; }
tbody tr:nth-child(even) { background: #fff; }
tbody tr:hover { background: #f6f9fa; }
td.num { text-align: center; font-variant-numeric: tabular-nums; }
.rate { width: 92px; height: 8px; background: #e7eef0; border-radius: 99px; overflow: hidden; display: inline-block; margin-right: 8px; }
.rate i { display: block; height: 100%; background: var(--teal); border-radius: 99px; }
.rate.over i { background: var(--danger); }
.table-wrap { overflow: auto; }
.filterbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.filterbar input, .filterbar select { border: 1px solid var(--input-line); padding: 9px 11px; border-radius: 9px; background: #fff; color: var(--text); }
.dashboard-section { margin-top: 20px; }
.chart { display: flex; align-items: flex-end; gap: 15px; height: 230px; padding: 20px 12px 5px; }
.bar-col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 7px; min-width: 32px; }
.bar { width: 70%; max-width: 38px; background: linear-gradient(#2b819d, #17857b); border-radius: 7px 7px 2px 2px; min-height: 3px; position: relative; }
.bar.over { background: linear-gradient(#d76d58, #b9434b); }
.bar-col span { font-size: 11px; color: var(--muted); }
.bar-col b { font-size: 11px; }
.dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.empty-state { text-align: center; color: var(--muted); padding: 34px; }
.footnote { text-align: center; color: #82919a; font-size: 12px; padding: 26px; }
.toast { position: fixed; right: 24px; bottom: 24px; background: var(--navy); color: #fff; padding: 13px 18px; border-radius: 11px; box-shadow: 0 10px 30px rgba(23, 50, 77, .18); z-index: 50; }
.required { color: var(--danger); }
.subtabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; border-bottom: 1px solid var(--line); padding-bottom: 10px; }
.subtab { border: 0; background: transparent; color: var(--muted); padding: 10px 15px; border-radius: 9px; cursor: pointer; font-weight: 800; }
.subtab.active { background: var(--navy); color: #fff; }
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
  .login-intro { padding: 28px; border-right: 0; border-bottom: 1px solid #d9e3e7; }
  .login-intro h1 { font-size: 28px; }
  .nursing-visual { width: min(100%, 300px); margin: 0 auto; padding-top: 16px; }
  .nursing-visual img { max-height: 210px; }
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
