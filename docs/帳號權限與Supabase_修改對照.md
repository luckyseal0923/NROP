> 此為初版修改紀錄；目前請以 [護理部與管理者審核註冊修改對照](護理部與管理者審核註冊_修改對照.md) 的完整新版檔案為準。

# 帳號權限與 Supabase：完整修改對照

日期：2026-10-26。原版為任意密碼登入＋前端 DEMO＋localStorage；新版改為 Supabase Auth、NROP 專屬權限 RPC 與資料庫 DEMO。

修改後的首頁會載入 src/main.js，以下提供完整檔案，複製時請保持檔案位置。SQL 安裝由使用者在 SQL Editor 執行；完整資料庫檔案見 supabase/INSTALL.sql，首位管理者見 supabase/003_bootstrap_admin.sql。沒有修改 .env.local 的內容。

## 修改前：index.html（完整）

```html
<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>護理即時動態平台 NROP</title>
  <link rel="stylesheet" href="./assets/theme.css">
</head>
<body>
  <header class="topbar">
    <div class="brand"><div class="brand-copy"><div class="brand-title">護理即時動態平台 NROP</div><div class="brand-subtitle">Nursing Real-Time Operations Platform</div></div></div>
    <div class="top-actions" id="sessionArea" hidden><span class="user-chip" id="userChip"></span><button class="btn btn-ghost" id="logoutBtn">登出</button></div>
  </header>

  <main id="loginView" class="login-wrap">
    <section class="login-card">
      <div class="login-intro">
        <img class="intro-art" src="./assets/nrop-hospital-hero.png" width="1086" height="1448" alt="" aria-hidden="true" fetchpriority="high">
        <div class="intro-copy">
          <h1>護理即時動態平台</h1>
          <p>整合班別填報、床位動態與人力統計。</p>
        </div>
      </div>
      <form class="login-form" id="loginForm"><h2>登入平台</h2><p>請選擇身分與單位進入示範系統</p>
        <div class="field"><label for="role">登入身分</label><select id="role"><option value="unit">單位填報者</option><option value="admin">護理部管理者</option></select></div>
        <div class="field" id="unitField"><label for="loginUnit">所屬單位</label><select id="loginUnit"></select></div>
        <div class="field"><label for="account">帳號</label><input id="account" value="demo" autocomplete="username"></div>
        <div class="field"><label for="password">密碼</label><input id="password" type="password" value="1234" autocomplete="current-password"></div>
        <button class="btn btn-primary" type="submit">登入</button><div class="demo-note">這是靜態展示版本，輸入任意帳號與密碼即可登入。資料僅保存在此瀏覽器。</div>
      </form>
    </section>
  </main>

  <main id="appView" class="wrap hidden">
    <div class="page-head"><div><h1 id="pageTitle">單位每日填報</h1><p id="pageSubtitle"></p></div><div class="tabs"><button class="tab active" data-view="entry">單位填報</button><button class="tab" data-view="dashboard">管理儀表板</button></div></div>

    <section id="entryView">
      <div id="standardEntryGrid" class="grid-2">
        <article class="card"><div class="card-head"><h2>當班動態資料</h2><span id="recordStatus" class="status empty">尚未填寫</span></div><div class="card-body">
          <div class="form-context"><div class="context-box"><small>填報單位</small><strong id="currentUnit"></strong></div><div class="context-box"><small>日期</small><input type="date" id="entryDate" style="border:0;background:transparent;width:100%;font-weight:700"></div><div class="context-box"><small>班別</small><select id="entryShift" style="border:0;background:transparent;width:100%;font-weight:700"><option value="N">N｜00–08</option><option value="D">D｜08–16</option><option value="E">E｜16–24</option></select></div><div class="context-box"><small>有效床數</small><strong><span id="bedCount">0</span> 床</strong></div></div>
          <div id="previousNotice" class="notice hidden"></div>
          <div class="input-section"><h3>人力與前班基準</h3><div class="entry-grid"><div class="number-field"><label>實際上班人力 <span class="required">*</span></label><input id="staff" type="number" min="0" step="0.001" inputmode="decimal" value="0"></div><div class="number-field"><label>前一班住院人數</label><input id="previous" type="number" readonly value="0"></div></div></div>
          <div class="input-section"><h3>當班異動（非累計）</h3><div id="admissionNotice" class="notice hidden"></div><div class="entry-grid" id="eventFields"></div><div id="admissionSummary" class="formula hidden" style="margin-top:14px"></div></div>
          <div class="input-section"><h3>系統自動計算</h3><div class="calc-strip"><div class="calc"><small>當班住院病人數</small><strong id="patientCount">0</strong></div><div class="calc"><small>空床數</small><strong id="emptyBeds">0</strong></div><div class="calc over"><small>超床數</small><strong id="overBeds">0</strong></div></div></div>
          <div class="actions"><button class="btn btn-soft" id="saveDraft">暫存</button><button class="btn btn-primary" id="submitRecord">正式送出</button></div>
        </div></article>
        <aside class="card"><div class="card-head"><h2>計算說明</h2></div><div class="card-body"><div class="formula">住院人數 ＝ 前班住院人數 ＋ 住院 − 出院 ＋ 機構內轉入 − 機構內轉出 − 死亡<br><br>病危僅作狀態註記，不列入計算，也不影響住院或空床數。</div><h3 style="font-size:15px;margin:22px 0 12px">今日班別進度</h3><div class="side-list" id="shiftProgress"></div></div></aside>
      </div>
      <div id="specialEntryView" class="hidden">
        <article class="card"><div class="card-head"><div><h2 id="specialFormTitle">特殊單位填報</h2><small style="color:var(--muted)">本區除合計外均為人工輸入</small></div><span id="specialRecordStatus" class="status empty">尚未填寫</span></div><div class="card-body">
          <div class="form-context"><div class="context-box"><small>填報單位</small><strong id="specialCurrentUnit"></strong></div><div class="context-box"><small>日期</small><input type="date" id="specialDate" style="border:0;background:transparent;width:100%;font-weight:700"></div><div class="context-box"><small>班別</small><select id="specialShift" style="border:0;background:transparent;width:100%;font-weight:700"><option value="N">N｜00–08</option><option value="D">D｜08–16</option><option value="E">E｜16–24</option></select></div><div class="context-box"><small>參考床數</small><strong id="specialBeds">—</strong></div></div>
          <div class="input-section"><h3>當班填報內容</h3><div id="staffBreakdownNotice" class="notice hidden"></div><div class="entry-grid" id="specialFields"></div></div>
          <div class="actions"><button class="btn btn-soft" id="saveSpecialDraft">暫存</button><button class="btn btn-primary" id="submitSpecialRecord">正式送出</button></div>
        </div></article>
      </div>
    </section>

    <section id="dashboardView" class="hidden">
      <div class="filterbar" style="margin-bottom:16px"><input type="date" id="dashboardDate"><select id="dashboardShift"><option value="N">N 班｜00–08</option><option value="D">D 班｜08–16</option><option value="E">E 班｜16–24</option></select></div>
      <div class="subtabs"><button class="subtab active" data-panel="shiftPanel">班別即時</button><button class="subtab" data-panel="dailyPanel">全日彙整</button><button class="subtab" data-panel="alertsPanel">異常 Log</button></div>
      <div id="shiftPanel"></div><div id="dailyPanel" class="hidden"><article class="card dashboard-section" id="specialOpsCard"><div class="card-head"><div><h2>特殊單位每日營運統整</h2><small style="color:var(--muted)">急診、產房、手術室、護理之家與洗腎室</small></div></div><div class="table-wrap"><table><thead><tr><th>單位</th><th>當日主要數值</th><th>N 班</th><th>D 班</th><th>E 班</th></tr></thead><tbody id="specialOpsTable"></tbody></table></div></article></div><div id="alertsPanel" class="hidden"></div>
      <article class="card" style="margin-bottom:20px"><div class="card-head"><div><h2>全日統整（N＋D＋E）</h2><small style="color:var(--muted)">彙整所選日期三個班別的當日動態</small></div><span class="status done" id="dailyStatus">0/0 班完成</span></div><div class="card-body"><div class="summary-grid" style="margin-bottom:0"><div class="metric"><div class="label">E 班期末住院</div><span class="value" id="dClosing">0</span><span class="unit">人</span></div><div class="metric"><div class="label">當日住院</div><span class="value" id="dAdmissions">0</span><span class="unit">人次</span></div><div class="metric"><div class="label">當日出院</div><span class="value" id="dDischarges">0</span><span class="unit">人次</span></div><div class="metric"><div class="label">機構內轉入／轉出</div><span class="value" id="dTransfers">0／0</span><span class="unit">人次</span></div><div class="metric"><div class="label">病危／死亡</div><span class="value" id="dCriticalDeaths">0／0</span><span class="unit">人次</span></div><div class="metric"><div class="label">三班上班人力合計</div><span class="value" id="dStaff">0</span><span class="unit">人次</span></div></div></div></article>
      <div style="font-weight:800;color:var(--navy);margin:2px 0 12px">所選班別統計</div>
      <div class="summary-grid"><div class="metric"><div class="label">有效床數</div><span class="value" id="mBeds">0</span><span class="unit">床</span></div><div class="metric"><div class="label">住院病人</div><span class="value" id="mPatients">0</span><span class="unit">人</span></div><div class="metric"><div class="label">空床</div><span class="value" id="mEmpty">0</span><span class="unit">床</span></div><div class="metric warning"><div class="label">超床</div><span class="value" id="mOver">0</span><span class="unit">床</span></div><div class="metric"><div class="label">實際上班人力</div><span class="value" id="mStaff">0</span><span class="unit">人</span></div><div class="metric"><div class="label">全院護病比</div><span class="value" id="mRatio">—</span></div><div class="metric"><div class="label">填報進度</div><span class="value" id="mProgress">0/0</span><span class="unit">單位</span></div></div>
      <div class="dashboard-grid" style="margin-bottom:20px">
        <article class="card"><div class="card-head"><h2>全院住院摘要（當日 E 班）</h2></div><div class="table-wrap"><table><thead><tr><th>全院總病床數</th><th>全院總病人數</th><th>全院總空床數</th></tr></thead><tbody><tr><td class="num"><b id="hospitalBeds">626</b></td><td class="num"><b id="closingPatients">0</b></td><td class="num"><b id="hospitalEmpty">626</b></td></tr></tbody></table></div><div style="padding:10px 20px;color:var(--muted);font-size:12px">總病人數＝一般病房＋特殊單位住院病人數；總空床數＝626－總病人數</div></article>
        <article class="card"><div class="card-head"><h2>護理之家（獨立統計）</h2></div><div class="table-wrap"><table><thead><tr><th>總病床數</th><th>機構內住民</th><th>保留床位</th><th>實際空床</th></tr></thead><tbody><tr><td class="num" id="nhBeds">39</td><td class="num"><b id="nhResidents">31</b></td><td class="num"><b id="nhReserved">6</b></td><td class="num"><b id="nhEmpty">2</b></td></tr></tbody></table></div></article>
      </div>
      <article class="card"><div class="card-head"><h2>各單位即時統計</h2><button class="btn btn-soft" id="exportBtn">匯出 CSV</button></div><div class="table-wrap"><table><thead><tr><th>單位</th><th>床數</th><th>住院</th><th>空床</th><th>超床</th><th>占床率</th><th>上班人力</th><th>護病比</th><th>病危</th><th>狀態</th></tr></thead><tbody id="unitTable"></tbody></table></div></article>
      <div class="dashboard-grid dashboard-section"><article class="card"><div class="card-head"><h2>各單位占床率</h2></div><div class="card-body"><div class="chart" id="occupancyChart"></div></div></article><article class="card"><div class="card-head"><h2>待完成填報</h2></div><div class="card-body"><div class="side-list" id="pendingList"></div></div></article></div>
      <article class="card dashboard-section"><div class="card-head"><div><h2>異常與漏填紀錄</h2><small style="color:var(--muted)">優先顯示過去未填寫、僅暫存及缺少必要欄位的資料</small></div><span class="status draft" id="alertCount">0 筆待處理</span></div><div class="table-wrap"><table><thead><tr><th>日期</th><th>班別</th><th>單位</th><th>異常類型</th><th>異常內容</th><th>處理狀態</th></tr></thead><tbody id="alertTable"></tbody></table></div></article>
      <article class="card dashboard-section"><div class="card-head"><h2>異常通報判定規則</h2></div><div class="card-body"><div class="formula">漏填異常：過去班別沒有紀錄、只有暫存、實際上班人力或必填事件欄位缺值。營運提醒：住院人數超過有效床數。住院人數與空床數由系統自動計算，不列為人工填報異常；數字 0 是有效資料，也不視為漏填。</div></div></article>
    </section>
    <div class="footnote">靜態展示版本 · 資料儲存於本機瀏覽器</div>
  </main>
  <div id="toast" class="toast hidden"></div>

  <script>
    const units=[
      {id:'6A',beds:39,type:'ward'},{id:'6B',beds:43,type:'ward'},{id:'7A',beds:45,type:'ward'},{id:'7B',beds:45,type:'ward'},{id:'8A',beds:32,type:'ward'},{id:'安寧病房',beds:10,type:'ward'},{id:'8B',beds:33,type:'ward'},{id:'9A',beds:45,type:'ward'},{id:'9B',beds:45,type:'ward'},{id:'10A',beds:45,type:'ward'},{id:'10B',beds:45,type:'ward'},{id:'11A',beds:40,type:'ward'},{id:'11B',beds:45,type:'ward'},{id:'12B',beds:10,type:'ward'},{id:'精神科急性病房',beds:30,type:'ward'},
      {id:'ICU-1',beds:12,type:'special'},{id:'ICU-2',beds:24,type:'special'},{id:'ICU-3',beds:9,type:'special'},{id:'NICU',beds:3,type:'special'},{id:'PICU',beds:2,type:'special'},{id:'BR',beds:10,type:'special'},{id:'NBC',beds:10,type:'special'},{id:'燙傷中心',beds:4,type:'special'}
    ];
    const operationalUnits=[
      {id:'急診',beds:33,type:'emergency',fields:[['staff','實際上班人力'],['visits','來診人數'],['referralIn','轉診入'],['referralOut','轉診出'],['admitted','住院'],['observation','留觀'],['deaths','死亡'],['surgeries','手術']]},
      {id:'產房',beds:6,type:'delivery',fields:[['staff','實際上班人力'],['visits','來診人數'],['observation','留觀'],['waiting','待產'],['cesarean','剖腹產'],['naturalBirth','自然產'],['drSurgery','DR 手術']]},
      {id:'手術室',beds:11,type:'operatingRoom',fields:[['staff','實際上班人力'],['inCount','IN'],['outCount','OUT']]},
      {id:'護理之家',beds:39,type:'nursingHome',fields:[['nurseStaff','護理師'],['aideStaff','護佐'],['staff','上班人力（自動合計）'],['residents','機構內住民人數'],['occupiedBeds','實際使用床數'],['reserved','保留床位'],['admitted','住院'],['discharged','出院']]},
      {id:'洗腎室',beds:61,type:'dialysis',fields:[['staff','實際上班人力'],['hemodialysisOutpatient','血液透析－門診'],['hemodialysisInpatient','血液透析－住院'],['hemodialysisCritical','血液透析－重症'],['peritonealDialysis','腹膜透析病人數']]}
    ];
    const allLoginUnits=[...units,...operationalUnits];
    const nursingHomeStaffFields=['nurseStaff','aideStaff'],specialStaffFields=['staff',...nursingHomeStaffFields];
    const shifts=['N','D','E'], events=['住院','出院','轉入','轉出','病危','死亡'];
    const specialtyAdmissions=[['住院本科','住院（本科）'],['住院非本科','住院（非本科）']],isolationAdmissions=[['住院一般病房','住院（一般病房）'],['住院負壓隔離','住院（負壓隔離）']];
    const admissionFieldsByUnit={'6A':specialtyAdmissions,'6B':specialtyAdmissions,'12B':isolationAdmissions,'ICU-3':isolationAdmissions};
    const admissionExportFields=[...specialtyAdmissions,...isolationAdmissions];
    const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
    const today=()=>{const d=new Date(),off=d.getTimezoneOffset();return new Date(d-off*60000).toISOString().slice(0,10)};
    const store={get(){return JSON.parse(localStorage.getItem('nursing-daily-records')||'{}')},set(v){localStorage.setItem('nursing-daily-records',JSON.stringify(v))}};
    let session=null;
    function organizeDashboard(){
      const dashboard=$('#dashboardView'),shiftPanel=$('#shiftPanel'),dailyPanel=$('#dailyPanel'),alertsPanel=$('#alertsPanel'),content=[...dashboard.children].slice(5);
      const [dailySummary,shiftLabel,shiftMetrics,closingSummary,unitStats,shiftCharts,alertLog,alertRules]=content;
      dailyPanel.prepend(dailySummary,closingSummary);shiftPanel.append(shiftLabel,shiftMetrics,unitStats,shiftCharts);alertsPanel.append(alertLog,alertRules);
      $$('.subtab').forEach(btn=>btn.onclick=()=>{$$('.subtab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');[shiftPanel,dailyPanel,alertsPanel].forEach(p=>p.classList.toggle('hidden',p.id!==btn.dataset.panel));$('#dashboardShift').classList.toggle('hidden',btn.dataset.panel!=='shiftPanel')});
    }
    organizeDashboard();
    const DEMO_DATA_ENABLED=true; // 正式版改為 false，即停止建立虛擬資料
    function seedDemoData(){
      if(!DEMO_DATA_ENABLED)return;
      const data=store.get(),start=new Date('2026-08-01T12:00:00'),end=new Date(today()+'T12:00:00'),dates=[],demoVersion='realistic-2026-09-v2';let added=false;end.setDate(end.getDate()-1);
      for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1))dates.push(d.toISOString().slice(0,10));
      if(localStorage.getItem('nursing-demo-version')!==demoVersion){
        Object.keys(data).forEach(k=>{const recordDate=k.startsWith('NH|')?k.slice(3):k.slice(0,10);if(recordDate>='2026-08-01'&&recordDate<='2026-09-02')delete data[k]});
        localStorage.setItem('nursing-demo-version',demoVersion);added=true;
      }
      units.forEach((u,ui)=>{
        let patients=Math.max(1,Math.round(u.beds*(.58+(ui%5)*.025)));
        dates.forEach((date,dayIndex)=>{
          shifts.forEach((shift,si)=>{
            let 入院=(ui+dayIndex+si*2)%9===0?1:0,出院=(ui*2+dayIndex+si)%11===0?1:0,轉入=(ui+dayIndex+si)%17===0?1:0,轉出=(ui*3+dayIndex+si)%19===0?1:0,死亡=(ui+dayIndex*3+si)%127===0?1:0;
            const minPatients=Math.max(0,Math.floor(u.beds*.48)),maxPatients=Math.max(1,Math.floor(u.beds*.78));
            let next=patients+入院-出院+轉入-轉出-死亡;
            if(next<minPatients){出院=0;轉出=0;死亡=0;next=patients+入院+轉入}
            if(next>maxPatients){入院=0;轉入=0;next=patients-出院-轉出-死亡}
            patients=next;
            const 病危=(ui*3+dayIndex+si)%71===0?1:0;
            const staff=Math.max(1,Math.round(u.beds/(shift==='D'?9:shift==='E'?12:14))+(ui+si)%2);
            const recordKey=key(date,shift,u.id);if(!data[recordKey]){data[recordKey]={staff,住院:入院,出院,轉入,轉出,病危,死亡,patients,empty:Math.max(u.beds-patients,0),over:Math.max(patients-u.beds,0),status:'submitted',isDemo:true,updatedAt:`${date}T${shift==='N'?'07:45':shift==='D'?'15:45':'23:45'}:00`};added=true}else patients=data[recordKey].patients??patients;
          });
        });
      });
      operationalUnits.forEach((u,ui)=>dates.forEach((date,dayIndex)=>shifts.forEach((shift,si)=>{
        const recordKey=operationalKey(date,shift,u.id);if(data[recordKey])return;
        const r={status:'submitted',isDemo:true,updatedAt:`${date}T${shift==='N'?'07:45':shift==='D'?'15:45':'23:45'}:00`};
        u.fields.forEach(([field])=>{if(u.type!=='nursingHome'||!nursingHomeStaffFields.includes(field))r[field]=0});
        r.staff=Math.max(1,Math.round(u.beds/(shift==='D'?10:14)));
        if(u.type==='emergency'){r.visits=12+((dayIndex*3+si*5)%15);r.referralIn=(dayIndex+si)%7===0?1:0;r.referralOut=(dayIndex+si)%9===0?1:0;r.admitted=2+((dayIndex+si)%4);r.observation=8+((dayIndex*2+si)%9);r.deaths=(dayIndex+si)%43===0?1:0;r.surgeries=(dayIndex+si)%6===0?1:0}
        if(u.type==='delivery'){r.visits=1+((dayIndex+si)%4);r.observation=(dayIndex+si)%3;r.waiting=(dayIndex*2+si)%3;r.cesarean=(dayIndex+si)%5===0?1:0;r.naturalBirth=(dayIndex+si)%4===0?1:0;r.drSurgery=r.cesarean}
        if(u.type==='operatingRoom'){r.inCount=shift==='D'?10+(dayIndex%7):shift==='E'?3+(dayIndex%4):(dayIndex%3);r.outCount=r.inCount}
        if(u.type==='nursingHome'){r.residents=31;r.occupiedBeds=31;r.reserved=6;r.admitted=(dayIndex+si)%29===0?1:0;r.discharged=(dayIndex+si)%31===0?1:0}
        if(u.type==='dialysis'){r.hemodialysisOutpatient=shift==='D'?25+(dayIndex%8):shift==='E'?16+(dayIndex%7):0;r.hemodialysisInpatient=shift==='D'?3+(dayIndex%3):shift==='E'?1+(dayIndex%2):0;r.peritonealDialysis=(dayIndex+si)%5}
        data[recordKey]=r;added=true;
      })));
      dates.forEach(date=>{const nhKey=`NH|${date}`;if(!data[nhKey]){data[nhKey]={beds:39,residents:31,reserved:6,empty:2,isDemo:true,updatedAt:`${date}T23:45:00`};added=true}else if(data[nhKey].reserved===undefined){data[nhKey].reserved=6;data[nhKey].empty=Math.max(data[nhKey].beds-data[nhKey].residents-6,0);added=true}});
      if(added)store.set(data);
    }
    seedDemoData();
    function seedDemoAnomalies(){
      const data=store.get(),samples=[
        ['2026-08-12','E','8B','draft'],
        ['2026-08-19','N','ICU-2','missingStaff'],
        ['2026-09-01','E','9A','empty']
      ];let changed=false;
      samples.forEach(([date,shift,unit,kind])=>{const r=data[key(date,shift,unit)];if(!r||!r.isDemo)return;if(kind==='missingStaff'){if(r.staff!==null){r.staff=null;r.status='draft';changed=true}}else if(r.status!==kind){r.status=kind;changed=true}});
      if(changed)store.set(data);
    }
    seedDemoAnomalies();
    $('#loginUnit').innerHTML=allLoginUnits.map(u=>`<option value="${u.id}">${u.id}</option>`).join('');
    $('#entryDate').value=$('#specialDate').value=$('#dashboardDate').value=today();
    $('#role').addEventListener('change',e=>$('#unitField').classList.toggle('hidden',e.target.value==='admin'));
    $('#loginForm').addEventListener('submit',e=>{e.preventDefault();const role=$('#role').value;session={role,unit:role==='admin'?units[0].id:$('#loginUnit').value,account:$('#account').value||'demo'};openApp()});
    $('#logoutBtn').onclick=()=>{session=null;$('#appView').classList.add('hidden');$('#loginView').classList.remove('hidden');$('#sessionArea').hidden=true};
    function openApp(){
      $('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden');$('#sessionArea').hidden=false;
      $('#userChip').textContent=session.role==='admin'?'護理部管理者':`${session.unit}｜填報者`;
      $('#currentUnit').textContent=session.unit;$('#pageSubtitle').textContent=session.role==='admin'?'查看全院當日填報與床位概況':`${session.unit} 單位資料僅供授權人員填寫`;
      $$('.tab').forEach(t=>{if(session.role!=='admin'&&t.dataset.view==='dashboard')t.classList.add('hidden')});renderEntry();renderDashboard();
    }
    $$('.tab').forEach(t=>t.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');const dash=t.dataset.view==='dashboard';$('#entryView').classList.toggle('hidden',dash);$('#dashboardView').classList.toggle('hidden',!dash);$('#pageTitle').textContent=dash?'全院當日動態':'單位每日填報';if(dash)renderDashboard()});
    const eventLabels={轉入:'機構內轉入',轉出:'機構內轉出',病危:'病危（不列入計算）'};
    function entryEventFields(unit){return events.flatMap(n=>n==='住院'&&admissionFieldsByUnit[unit]?admissionFieldsByUnit[unit]:[[n,eventLabels[n]||n]])}
    function admissionTotal(record,unit){
      const fields=admissionFieldsByUnit[unit];
      return fields&&fields.every(([field])=>record[field]!==undefined&&record[field]!==null&&record[field]!=='')?fields.reduce((sum,[field])=>sum+(Number(record[field])||0),0):record.住院||0;
    }
    function renderEventFields(record){
      const split=admissionFieldsByUnit[session.unit]||[],needsBreakdown=(record.住院||0)>0&&split.some(([field])=>record[field]===undefined||record[field]===null||record[field]==='');
      $('#eventFields').innerHTML=entryEventFields(session.unit).map(([field,label])=>{
        const isAdmissionPart=split.some(([name])=>name===field),value=record[field]??(isAdmissionPart&&needsBreakdown?'':0);
        return `<div class="number-field"><label>${label}</label><input class="event-input" data-event="${field}" type="number" min="0" step="1" value="${value}"${isAdmissionPart?' data-admission-part required':''}></div>`;
      }).join('');
      $$('.event-input').forEach(input=>input.oninput=calculate);
    }
    $('#entryDate').onchange=$('#entryShift').onchange=renderEntry;
    $('#staff').oninput=calculate;
    function key(date,shift,unit){return `${date}|${shift}|${unit}`}
    function previousKey(date,shift,unit){let d=new Date(date+'T12:00:00'),s;if(shift==='N'){d.setDate(d.getDate()-1);s='E'}else{s=shift==='D'?'N':'D'}return key(d.toISOString().slice(0,10),s,unit)}
    function emptyRecord(){return{staff:0,住院:0,出院:0,轉入:0,轉出:0,病危:0,死亡:0,status:'empty'}}
    function getBase(){const data=store.get(),pk=previousKey($('#entryDate').value,$('#entryShift').value,session.unit),prior=data[pk];return{value:prior?.patients??0,ready:prior?.status==='submitted'}}
    function renderEntry(){
      const operational=operationalUnits.find(x=>x.id===session.unit);
      $('#standardEntryGrid').classList.toggle('hidden',!!operational);$('#specialEntryView').classList.toggle('hidden',!operational);
      if(operational){renderSpecialForm();return}
      const u=units.find(x=>x.id===session.unit),data=store.get(),rec=data[key($('#entryDate').value,$('#entryShift').value,session.unit)]||emptyRecord(),base=getBase();
      $('#bedCount').textContent=u.beds;$('#staff').value=rec.staff;renderEventFields(rec);$('#previous').value=base.value;
      $('#previousNotice').classList.toggle('hidden',base.ready);$('#previousNotice').textContent='前一班尚未正式送出，目前可暫存；前班完成後系統將依最新資料重新計算。';
      setStatus(rec.status);calculate();renderProgress();
    }
    function operationalKey(date,shift,unit){return `OPS|${date}|${shift}|${unit}`}
    function hasNursingHomeStaffSplit(record){return nursingHomeStaffFields.every(field=>record[field]!==undefined&&record[field]!==null&&record[field]!=='')}
    function nursingHomeStaff(record){return hasNursingHomeStaffSplit(record)?nursingHomeStaffFields.reduce((sum,field)=>sum+Math.round((Number(record[field])||0)*1000),0)/1000:record.staff||0}
    function renderSpecialForm(){
      const u=operationalUnits.find(x=>x.id===session.unit),data=store.get(),rec=data[operationalKey($('#specialDate').value,$('#specialShift').value,u.id)]||{status:'empty'};
      $('#specialFormTitle').textContent=`${u.id}每日動態填報`;$('#specialCurrentUnit').textContent=u.id;$('#specialBeds').textContent=`${u.beds} 床`;
      const isNursingHome=u.type==='nursingHome',needsBreakdown=isNursingHome&&!hasNursingHomeStaffSplit(rec)&&(rec.staff||0)>0;
      $('#specialFields').innerHTML=u.fields.map(([field,label])=>{
        const isStaff=specialStaffFields.includes(field),isPart=isNursingHome&&nursingHomeStaffFields.includes(field),isTotal=isNursingHome&&field==='staff',value=isTotal?nursingHomeStaff(rec):rec[field]??(isPart&&needsBreakdown?'':0);
        return `<div class="number-field"><label>${label}</label><input class="special-input" data-field="${field}" type="number" min="0" step="${isStaff?'0.001':'1'}" inputmode="${isStaff?'decimal':'numeric'}" value="${value}"${isPart?' data-staff-part required':''}${isTotal?' readonly':''}></div>`;
      }).join('');
      $('#staffBreakdownNotice').classList.add('hidden');
      if(isNursingHome){$$('.special-input[data-staff-part]').forEach(input=>input.oninput=updateNursingHomeStaff);updateNursingHomeStaff()}
      const el=$('#specialRecordStatus'),text=rec.status==='submitted'?'已完成':rec.status==='draft'?'已暫存':'尚未填寫';el.className=`status ${rec.status||'empty'}`;el.textContent=text;
    }
    function updateNursingHomeStaff(){
      const inputs=$$('.special-input[data-staff-part]'),complete=inputs.every(input=>input.value!==''&&input.validity.valid),record=store.get()[operationalKey($('#specialDate').value,$('#specialShift').value,session.unit)]||{};
      const parts=Object.fromEntries(inputs.map(input=>[input.dataset.field,Number(input.value)]));
      $('.special-input[data-field="staff"]').value=formatStaff(complete?nursingHomeStaff(parts):nursingHomeStaff(record));
      $('#staffBreakdownNotice').classList.toggle('hidden',complete);$('#staffBreakdownNotice').textContent=`請填齊護理師與護佐人力，均可輸入至小數點後三位，無此職類請填 0。分類未完成前保留原紀錄上班人力 ${formatStaff(nursingHomeStaff(record))}，補填後再儲存。`;
    }
    $('#specialDate').onchange=$('#specialShift').onchange=renderSpecialForm;
    function saveSpecial(status){
      if(!$$('.special-input').filter(input=>specialStaffFields.includes(input.dataset.field)).every(input=>input.reportValidity()))return;
      const u=operationalUnits.find(x=>x.id===session.unit),data=store.get(),record={status,updatedAt:new Date().toISOString()};
      $$('.special-input').forEach(input=>record[input.dataset.field]=Math.max(0,(specialStaffFields.includes(input.dataset.field)?parseFloat(input.value):parseInt(input.value))||0));
      if(u.type==='nursingHome')record.staff=nursingHomeStaff(record);
      data[operationalKey($('#specialDate').value,$('#specialShift').value,u.id)]=record;store.set(data);renderSpecialForm();renderDashboard();toast(status==='draft'?'資料已暫存':'資料已正式送出');
    }
    $('#saveSpecialDraft').onclick=()=>saveSpecial('draft');$('#submitSpecialRecord').onclick=()=>saveSpecial('submitted');
    function values(){
      const v={staff:Math.max(0,parseFloat($('#staff').value)||0)},split=admissionFieldsByUnit[session.unit]||[];
      entryEventFields(session.unit).forEach(([field])=>{const input=document.querySelector(`[data-event="${field}"]`);v[field]=input.value===''&&split.some(([name])=>name===field)?null:Math.max(0,parseInt(input.value)||0)});
      if(split.length){const record=store.get()[key($('#entryDate').value,$('#entryShift').value,session.unit)]||emptyRecord();v.住院=admissionTotal({...record,...v},session.unit)}
      return v;
    }
    function calculate(){
      const v=values(),base=getBase().value,beds=units.find(x=>x.id===session.unit).beds,patients=base+v.住院-v.出院+v.轉入-v.轉出-v.死亡,split=admissionFieldsByUnit[session.unit]||[],incomplete=split.some(([field])=>v[field]===null);
      $('#patientCount').textContent=patients;$('#emptyBeds').textContent=Math.max(beds-patients,0);$('#overBeds').textContent=Math.max(patients-beds,0);
      $('#admissionSummary').classList.toggle('hidden',!split.length);$('#admissionSummary').textContent=`住院合計：${v.住院} 人次（${incomplete?'暫沿用原紀錄，請補填分類':'兩欄相加，計入當班住院病人數'}）`;
      $('#admissionNotice').classList.toggle('hidden',!incomplete);$('#admissionNotice').textContent=`原紀錄住院合計 ${v.住院} 人次，尚未完成分類。請補填兩欄後再儲存，無此類住院請填 0。`;
    }
    function validateEntry(){return $('#staff').reportValidity()&&$$('.event-input[data-admission-part]').every(input=>input.reportValidity())}
    function setStatus(s){const el=$('#recordStatus'),map={empty:'尚未填寫',draft:'已暫存',submitted:'已完成'};el.className=`status ${s}`;el.textContent=map[s]}
    function save(status){
      if(!validateEntry())return false;
      const data=store.get(),k=key($('#entryDate').value,$('#entryShift').value,session.unit),v=values(),base=getBase(),beds=units.find(x=>x.id===session.unit).beds,patients=base.value+v.住院-v.出院+v.轉入-v.轉出-v.死亡;
      data[k]={...v,patients,empty:Math.max(beds-patients,0),over:Math.max(patients-beds,0),status,updatedAt:new Date().toISOString()};
      for(let pass=0;pass<4;pass++) Object.keys(data).filter(x=>x.endsWith('|'+session.unit)).sort().forEach(recordKey=>{const [date,shift,unit]=recordKey.split('|'),prior=data[previousKey(date,shift,unit)];if(!prior)return;const r=data[recordKey],b=units.find(x=>x.id===unit).beds,p=prior.patients+admissionTotal(r,unit)-(r.出院||0)+(r.轉入||0)-(r.轉出||0)-(r.死亡||0);r.住院=admissionTotal(r,unit);r.patients=p;r.empty=Math.max(b-p,0);r.over=Math.max(p-b,0)});
      store.set(data);setStatus(status);renderProgress();renderDashboard();toast(status==='draft'?'資料已暫存':'資料已正式送出');return true;
    }
    $('#saveDraft').onclick=()=>save('draft');$('#submitRecord').onclick=()=>{if(!getBase().ready){if(save('draft'))toast('前一班尚未完成，資料已先暫存')}else save('submitted')};
    function renderProgress(){const data=store.get(),date=$('#entryDate').value;$('#shiftProgress').innerHTML=shifts.map(s=>{const r=data[key(date,s,session.unit)]||emptyRecord(),txt=r.status==='submitted'?'已完成':r.status==='draft'?'已暫存':'待填報';return `<div class="side-item"><div><b>${s} 班</b><small>${s==='N'?'00:00–08:00':s==='D'?'08:00–16:00':'16:00–24:00'}</small></div><span class="status ${r.status}">${txt}</span></div>`}).join('')}
    $('#dashboardDate').onchange=$('#dashboardShift').onchange=renderDashboard;
    function renderAlerts(data){
      const alerts=[],required=['staff','住院','出院','轉入','轉出','病危','死亡'],start=new Date('2026-08-01T12:00:00'),end=new Date(today()+'T12:00:00');end.setDate(end.getDate()-1);
      for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
        const date=d.toISOString().slice(0,10);
        units.forEach(u=>shifts.forEach(shift=>{
          const recordKey=key(date,shift,u.id),r=data[recordKey];
          if(!r){alerts.push({date,shift,unit:u.id,type:'漏填',detail:'此班別沒有填報紀錄',level:'empty'});return}
          if(r.status==='empty')alerts.push({date,shift,unit:u.id,type:'漏填',detail:'此班別尚未填寫',level:'empty'});
          else if(r.status==='draft')alerts.push({date,shift,unit:u.id,type:'未送出',detail:'資料只有暫存，尚未正式送出',level:'draft'});
          const missing=required.filter(f=>r[f]===null||r[f]===undefined||r[f]==='');
          if(missing.length)alerts.push({date,shift,unit:u.id,type:'欄位缺值',detail:`缺少：${missing.map(x=>x==='staff'?'實際上班人力':x).join('、')}`,level:'draft'});
          if((r.over||0)>0)alerts.push({date,shift,unit:u.id,type:'超床',detail:`超過有效床數 ${r.over} 床`,level:'draft'});
        }));
      }
      const priority={漏填:0,未送出:1,欄位缺值:2,超床:3};alerts.sort((a,b)=>(priority[a.type]-priority[b.type])||b.date.localeCompare(a.date));
      $('#alertCount').textContent=`${alerts.length} 筆待處理`;
      $('#alertTable').innerHTML=alerts.length?alerts.slice(0,100).map(a=>`<tr><td>${a.date}</td><td>${a.shift}</td><td><b>${a.unit}</b></td><td><span class="status ${a.level}">${a.type}</span></td><td>${a.detail}</td><td>待確認</td></tr>`).join(''):'<tr><td colspan="6"><div class="empty-state">目前沒有異常或漏填紀錄</div></td></tr>';
    }
    function formatStaff(value){return String(Number((value||0).toFixed(3)))}
    function formatNursePatientRatio(patientCount,staffCount){return staffCount>0?`1：${(patientCount/staffCount).toFixed(1).replace(/\.0$/,'')}`:'—'}
    function renderDashboard(){
      const date=$('#dashboardDate').value,shift=$('#dashboardShift').value,data=store.get();let beds=0,patients=0,empty=0,over=0,staff=0,done=0;
      const daily={住院:0,出院:0,轉入:0,轉出:0,病危:0,死亡:0,staff:0,completed:0,closing:0};
      units.forEach(u=>shifts.forEach(s=>{const r=data[key(date,s,u.id)];if(!r)return;daily.住院+=admissionTotal(r,u.id);daily.出院+=r.出院||0;daily.轉入+=r.轉入||0;daily.轉出+=r.轉出||0;daily.病危+=r.病危||0;daily.死亡+=r.死亡||0;daily.staff+=r.staff||0;if(r.status==='submitted')daily.completed++;if(s==='E')daily.closing+=r.patients||0}));
      operationalUnits.forEach(u=>shifts.forEach(s=>{const r=data[operationalKey(date,s,u.id)];if(!r)return;daily.staff+=u.type==='nursingHome'?nursingHomeStaff(r):r.staff||0;if(r.status==='submitted')daily.completed++}));
      $('#dClosing').textContent=daily.closing;$('#dAdmissions').textContent=daily.住院;$('#dDischarges').textContent=daily.出院;$('#dTransfers').textContent=`${daily.轉入}／${daily.轉出}`;$('#dCriticalDeaths').textContent=`${daily.病危}／${daily.死亡}`;$('#dStaff').textContent=formatStaff(daily.staff);
      const dailyStatus=$('#dailyStatus'),allShiftRecords=allLoginUnits.length*shifts.length;dailyStatus.textContent=`${daily.completed}/${allShiftRecords} 班完成`;dailyStatus.className=`status ${daily.completed===allShiftRecords?'done':'draft'}`;
      $('#specialOpsTable').innerHTML=operationalUnits.map(u=>{
        const records=shifts.map(s=>data[operationalKey(date,s,u.id)]||{status:'empty'}),sum=f=>records.reduce((n,r)=>n+(r[f]||0),0),last=records[2];
        let summary='';
        if(u.type==='emergency')summary=`來診 ${sum('visits')}、住院 ${sum('admitted')}、E班留觀 ${last.observation||0}`;
        if(u.type==='delivery')summary=`來診 ${sum('visits')}、自然產 ${sum('naturalBirth')}、剖腹產 ${sum('cesarean')}`;
        if(u.type==='operatingRoom')summary=`IN ${sum('inCount')}、OUT ${sum('outCount')}`;
        if(u.type==='nursingHome'){
          const staffTotal=records.reduce((total,r)=>total+nursingHomeStaff(r),0),needsBreakdown=records.some(r=>(r.staff||0)>0&&!hasNursingHomeStaffSplit(r));
          const staffing=needsBreakdown?`三班上班人力 ${formatStaff(staffTotal)} 人次（護理師／護佐待補分類）`:`三班人力：護理師 ${formatStaff(sum('nurseStaff'))}、護佐 ${formatStaff(sum('aideStaff'))}、合計 ${formatStaff(staffTotal)} 人次`;
          summary=`住民 ${last.residents||0}、保留床 ${last.reserved||0}、空床 ${Math.max(u.beds-(last.residents||0)-(last.reserved||0),0)}；${staffing}`;
        }
        if(u.type==='dialysis')summary=`血液透析：門診 ${sum('hemodialysisOutpatient')}、住院 ${sum('hemodialysisInpatient')}、重症 ${sum('hemodialysisCritical')}；腹膜透析 ${sum('peritonealDialysis')}`;
        const state=r=>`<span class="status ${r.status||'empty'}">${r.status==='submitted'?'完成':r.status==='draft'?'暫存':'未填'}</span>`;
        return `<tr><td><b>${u.id}</b></td><td>${summary}</td><td>${state(records[0])}</td><td>${state(records[1])}</td><td>${state(records[2])}</td></tr>`;
      }).join('');
      const rows=units.map(u=>{const r=data[key(date,shift,u.id)]||emptyRecord(),p=r.patients||0,e=Math.max(u.beds-p,0),o=Math.max(p-u.beds,0),rate=u.beds?Math.round(p/u.beds*100):0;beds+=u.beds;patients+=p;empty+=e;over+=o;staff+=r.staff||0;if(r.status==='submitted')done++;return{u,r,p,e,o,rate}});
      $('#mBeds').textContent=beds;$('#mPatients').textContent=patients;$('#mEmpty').textContent=empty;$('#mOver').textContent=over;$('#mStaff').textContent=formatStaff(staff);$('#mRatio').textContent=formatNursePatientRatio(patients,staff);$('#mProgress').textContent=`${done}/${units.length}`;
      const hospitalBeds=626,closingPatients=units.reduce((sum,u)=>sum+(data[key(date,'E',u.id)]?.patients||0),0),nh=data[`NH|${date}`]||{beds:39,residents:31,reserved:6};const nhEmpty=Math.max(nh.beds-nh.residents-(nh.reserved||0),0);$('#hospitalBeds').textContent=hospitalBeds;$('#closingPatients').textContent=closingPatients;$('#hospitalEmpty').textContent=Math.max(hospitalBeds-closingPatients,0);$('#nhBeds').textContent=nh.beds;$('#nhResidents').textContent=nh.residents;$('#nhReserved').textContent=nh.reserved||0;$('#nhEmpty').textContent=nhEmpty;
      $('#unitTable').innerHTML=rows.map(x=>`<tr><td><b>${x.u.id}</b></td><td class="num">${x.u.beds}</td><td class="num">${x.p}</td><td class="num">${x.e}</td><td class="num">${x.o}</td><td><span class="rate ${x.rate>100?'over':''}"><i style="width:${Math.min(x.rate,100)}%"></i></span>${x.rate}%</td><td class="num">${formatStaff(x.r.staff)}</td><td class="num"><b>${formatNursePatientRatio(x.p,x.r.staff||0)}</b></td><td class="num">${x.r.病危||0}</td><td><span class="status ${x.r.status}">${x.r.status==='submitted'?'完成':x.r.status==='draft'?'暫存':'未填'}</span></td></tr>`).join('');
      $('#occupancyChart').innerHTML=rows.map(x=>`<div class="bar-col"><b>${x.rate}%</b><div class="bar ${x.rate>100?'over':''}" style="height:${Math.max(Math.min(x.rate,120)/120*150,3)}px"></div><span>${x.u.id}</span></div>`).join('');
      const pending=rows.filter(x=>x.r.status!=='submitted');$('#pendingList').innerHTML=pending.length?pending.slice(0,10).map(x=>`<div class="side-item"><div><b>${x.u.id}</b><small>${shift} 班資料</small></div><span class="status ${x.r.status}">${x.r.status==='draft'?'已暫存':'尚未填寫'}</span></div>`).join(''):'<div class="empty-state">所有單位皆已完成填報</div>';
      renderAlerts(data);
    }
    $('#exportBtn').onclick=()=>{
      const date=$('#dashboardDate').value,shift=$('#dashboardShift').value,data=store.get(),head=['日期','班別','單位','床數','住院人數','空床數','超床數','上班人力','護病比','病危','狀態','當班住院合計',...admissionExportFields.map(([,label])=>label)].join(',')+'\n';
      const body=units.map(u=>{const r=data[key(date,shift,u.id)]||emptyRecord(),p=r.patients||0,fields=admissionFieldsByUnit[u.id]||[];return[date,shift,u.id,u.beds,p,Math.max(u.beds-p,0),Math.max(p-u.beds,0),formatStaff(r.staff),formatNursePatientRatio(p,r.staff||0),r.病危||0,r.status,admissionTotal(r,u.id),...admissionExportFields.map(([field])=>fields.some(([name])=>name===field)?r[field]??'':'')].join(',')}).join('\n');
      const blob=new Blob(['\ufeff'+head+body],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`護理動態_${date}_${shift}.csv`;a.click();URL.revokeObjectURL(a.href);
    };
    function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.add('hidden'),2300)}
  </script>
</body>
</html>

```

## 修改前：assets/theme.css（完整）

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

## 修改後：index.html（完整）

```html
<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>護理即時動態平台 NROP</title>
  <link rel="stylesheet" href="./assets/theme.css">
</head>
<body>
  <header class="topbar">
    <div class="brand"><div class="brand-copy"><div class="brand-title">護理即時動態平台 NROP</div><div class="brand-subtitle">Nursing Real-Time Operations Platform</div></div></div>
    <div class="top-actions" id="sessionArea" hidden><span class="user-chip" id="userChip"></span><button class="btn btn-ghost" id="changePasswordBtn">變更密碼</button><button class="btn btn-ghost" id="logoutBtn">登出</button></div>
  </header>

  <main id="loginView" class="login-wrap">
    <section class="login-card">
      <div class="login-intro">
        <img class="intro-art" src="./assets/nrop-hospital-hero.png" width="1086" height="1448" alt="" aria-hidden="true" fetchpriority="high">
        <div class="intro-copy">
          <h1>護理即時動態平台</h1>
          <p>整合班別填報、床位動態與人力統計。</p>
        </div>
      </div>
      <div class="login-form">
        <div class="subtabs auth-tabs"><button type="button" class="subtab active" data-auth="login">登入</button><button type="button" class="subtab" data-auth="register">申請帳號</button></div>
        <div id="connectionStatus" class="notice" role="status">正在連接 Supabase…</div>
        <form id="loginForm"><h2>登入平台</h2><p>使用 Email 與密碼登入，權限依核准的帳號決定。</p>
          <div class="field"><label for="account">Email 帳號</label><input id="account" type="email" autocomplete="username" required maxlength="254"></div>
          <div class="field"><label for="password">密碼</label><input id="password" type="password" autocomplete="current-password" required></div>
          <button class="btn btn-primary" type="submit">登入</button><button class="btn btn-link" id="forgotPassword" type="button">忘記密碼</button>
        </form>
        <form id="registerForm" class="hidden"><h2>申請帳號</h2><p>Email 驗證後，由系統管理者核准使用資格與所屬單位。</p>
          <div class="field"><label for="registerName">姓名</label><input id="registerName" required maxlength="80" autocomplete="name"></div>
          <div class="field"><label for="registerUnit">申請單位</label><select id="registerUnit" required></select></div>
          <div class="field"><label for="registerEmail">Email</label><input id="registerEmail" type="email" required maxlength="254" autocomplete="email"></div>
          <div class="field"><label for="registerPassword">密碼（至少 12 碼，含英文與數字）</label><input id="registerPassword" type="password" required minlength="12" autocomplete="new-password"></div>
          <button class="btn btn-primary" type="submit">送出申請</button>
        </form>
        <div id="authMessage" class="notice hidden" role="status" aria-live="polite"></div>
      </div>
    </section>
  </main>

  <main id="appView" class="wrap hidden">
    <div class="page-head"><div><h1 id="pageTitle">單位每日填報</h1><p id="pageSubtitle"></p></div><div class="tabs"><button class="tab active" data-view="entry">單位填報</button><button class="tab" data-view="dashboard">管理儀表板</button><button class="tab hidden" data-view="accounts">帳號管理</button></div></div>

    <div class="platform-tools"><label>資料區 <select id="datasetSelect"><option value="live">正式填報</option><option value="demo">DEMO 測試資料</option></select></label><label id="managedUnitField" class="hidden">填報單位 <select id="managedUnit"></select></label><button type="button" class="btn btn-soft" id="refreshData">重新整理</button><span id="syncStatus" role="status"></span></div>
    <div id="datasetNotice" class="notice"></div><div id="appError" class="notice error hidden" role="alert"></div>
    <section id="entryView">
      <div id="standardEntryGrid" class="grid-2">
        <article class="card"><div class="card-head"><h2>當班動態資料</h2><span id="recordStatus" class="status empty">尚未填寫</span></div><div class="card-body">
          <div class="form-context"><div class="context-box"><small>填報單位</small><strong id="currentUnit"></strong></div><div class="context-box"><small>日期</small><input type="date" id="entryDate" style="border:0;background:transparent;width:100%;font-weight:700"></div><div class="context-box"><small>班別</small><select id="entryShift" style="border:0;background:transparent;width:100%;font-weight:700"><option value="N">N｜00–08</option><option value="D">D｜08–16</option><option value="E">E｜16–24</option></select></div><div class="context-box"><small>有效床數</small><strong><span id="bedCount">0</span> 床</strong></div></div>
          <div id="previousNotice" class="notice hidden"></div>
          <div class="notice hidden" id="openingControls"><p>首次啟用的單位，由管理者確認期初住院人數。</p><label>期初住院人數 <input id="openingPatients" type="number" min="0" step="1" value="0"></label> <button type="button" class="btn btn-soft" id="setOpening">設定期初人數</button></div>
          <div class="input-section"><h3>人力與前班基準</h3><div class="entry-grid"><div class="number-field"><label>實際上班人力 <span class="required">*</span></label><input id="staff" type="number" min="0" step="0.001" inputmode="decimal" required value="0"></div><div class="number-field"><label>前一班住院人數</label><input id="previous" type="number" readonly value="0"></div></div></div>
          <div class="input-section"><h3>當班異動（非累計）</h3><div id="admissionNotice" class="notice hidden"></div><div class="entry-grid" id="eventFields"></div><div id="admissionSummary" class="formula hidden" style="margin-top:14px"></div></div>
          <div class="input-section"><h3>系統自動計算</h3><div class="calc-strip"><div class="calc"><small>當班住院病人數</small><strong id="patientCount">0</strong></div><div class="calc"><small>空床數</small><strong id="emptyBeds">0</strong></div><div class="calc over"><small>超床數</small><strong id="overBeds">0</strong></div></div></div>
          <div class="actions"><button class="btn btn-soft" id="saveDraft">暫存</button><button class="btn btn-primary" id="submitRecord">正式送出</button></div>
        </div></article>
        <aside class="card"><div class="card-head"><h2>計算說明</h2></div><div class="card-body"><div class="formula">住院人數 ＝ 前班住院人數 ＋ 住院 − 出院 ＋ 機構內轉入 − 機構內轉出 − 死亡<br><br>病危僅作狀態註記，不列入計算，也不影響住院或空床數。</div><h3 style="font-size:15px;margin:22px 0 12px">今日班別進度</h3><div class="side-list" id="shiftProgress"></div></div></aside>
      </div>
      <div id="specialEntryView" class="hidden">
        <article class="card"><div class="card-head"><div><h2 id="specialFormTitle">特殊單位填報</h2><small style="color:var(--muted)">本區除合計外均為人工輸入</small></div><span id="specialRecordStatus" class="status empty">尚未填寫</span></div><div class="card-body">
          <div class="form-context"><div class="context-box"><small>填報單位</small><strong id="specialCurrentUnit"></strong></div><div class="context-box"><small>日期</small><input type="date" id="specialDate" style="border:0;background:transparent;width:100%;font-weight:700"></div><div class="context-box"><small>班別</small><select id="specialShift" style="border:0;background:transparent;width:100%;font-weight:700"><option value="N">N｜00–08</option><option value="D">D｜08–16</option><option value="E">E｜16–24</option></select></div><div class="context-box"><small>參考床數</small><strong id="specialBeds">—</strong></div></div>
          <div class="input-section"><h3>當班填報內容</h3><div id="staffBreakdownNotice" class="notice hidden"></div><div class="entry-grid" id="specialFields"></div></div>
          <div class="actions"><button class="btn btn-soft" id="saveSpecialDraft">暫存</button><button class="btn btn-primary" id="submitSpecialRecord">正式送出</button></div>
        </div></article>
      </div>
    </section>

    <section id="dashboardView" class="hidden">
      <div class="filterbar" style="margin-bottom:16px"><input type="date" id="dashboardDate"><select id="dashboardShift"><option value="N">N 班｜00–08</option><option value="D">D 班｜08–16</option><option value="E">E 班｜16–24</option></select></div>
      <div class="subtabs"><button class="subtab active" data-panel="shiftPanel">班別即時</button><button class="subtab" data-panel="dailyPanel">全日彙整</button><button class="subtab" data-panel="alertsPanel">異常 Log</button></div>
      <div id="shiftPanel"></div><div id="dailyPanel" class="hidden"><article class="card dashboard-section" id="specialOpsCard"><div class="card-head"><div><h2>特殊單位每日營運統整</h2><small style="color:var(--muted)">急診、產房、手術室、護理之家與洗腎室</small></div></div><div class="table-wrap"><table><thead><tr><th>單位</th><th>當日主要數值</th><th>N 班</th><th>D 班</th><th>E 班</th></tr></thead><tbody id="specialOpsTable"></tbody></table></div></article></div><div id="alertsPanel" class="hidden"></div>
      <article class="card" style="margin-bottom:20px"><div class="card-head"><div><h2>全日統整（N＋D＋E）</h2><small style="color:var(--muted)">彙整所選日期三個班別的當日動態</small></div><span class="status done" id="dailyStatus">0/0 班完成</span></div><div class="card-body"><div class="summary-grid" style="margin-bottom:0"><div class="metric"><div class="label">E 班期末住院</div><span class="value" id="dClosing">0</span><span class="unit">人</span></div><div class="metric"><div class="label">當日住院</div><span class="value" id="dAdmissions">0</span><span class="unit">人次</span></div><div class="metric"><div class="label">當日出院</div><span class="value" id="dDischarges">0</span><span class="unit">人次</span></div><div class="metric"><div class="label">機構內轉入／轉出</div><span class="value" id="dTransfers">0／0</span><span class="unit">人次</span></div><div class="metric"><div class="label">病危／死亡</div><span class="value" id="dCriticalDeaths">0／0</span><span class="unit">人次</span></div><div class="metric"><div class="label">三班上班人力合計</div><span class="value" id="dStaff">0</span><span class="unit">人次</span></div></div></div></article>
      <div style="font-weight:800;color:var(--navy);margin:2px 0 12px">所選班別統計</div>
      <div class="summary-grid"><div class="metric"><div class="label">有效床數</div><span class="value" id="mBeds">0</span><span class="unit">床</span></div><div class="metric"><div class="label">住院病人</div><span class="value" id="mPatients">0</span><span class="unit">人</span></div><div class="metric"><div class="label">空床</div><span class="value" id="mEmpty">0</span><span class="unit">床</span></div><div class="metric warning"><div class="label">超床</div><span class="value" id="mOver">0</span><span class="unit">床</span></div><div class="metric"><div class="label">實際上班人力</div><span class="value" id="mStaff">0</span><span class="unit">人</span></div><div class="metric"><div class="label">全院護病比</div><span class="value" id="mRatio">—</span></div><div class="metric"><div class="label">填報進度</div><span class="value" id="mProgress">0/0</span><span class="unit">單位</span></div></div>
      <div class="dashboard-grid" style="margin-bottom:20px">
        <article class="card"><div class="card-head"><h2>全院住院摘要（當日 E 班）</h2></div><div class="table-wrap"><table><thead><tr><th>全院總病床數</th><th>全院總病人數</th><th>全院總空床數</th></tr></thead><tbody><tr><td class="num"><b id="hospitalBeds">626</b></td><td class="num"><b id="closingPatients">0</b></td><td class="num"><b id="hospitalEmpty">626</b></td></tr></tbody></table></div><div style="padding:10px 20px;color:var(--muted);font-size:12px">總病人數＝一般病房＋特殊單位住院病人數；總空床數＝有效病床數－總病人數</div></article>
        <article class="card"><div class="card-head"><h2>護理之家（獨立統計）</h2></div><div class="table-wrap"><table><thead><tr><th>總病床數</th><th>機構內住民</th><th>保留床位</th><th>實際空床</th></tr></thead><tbody><tr><td class="num" id="nhBeds">39</td><td class="num"><b id="nhResidents">—</b></td><td class="num"><b id="nhReserved">—</b></td><td class="num"><b id="nhEmpty">—</b></td></tr></tbody></table></div></article>
      </div>
      <article class="card"><div class="card-head"><h2>各單位即時統計</h2><button class="btn btn-soft" id="exportBtn">匯出 CSV</button></div><div class="table-wrap"><table><thead><tr><th>單位</th><th>床數</th><th>住院</th><th>空床</th><th>超床</th><th>占床率</th><th>上班人力</th><th>護病比</th><th>病危</th><th>狀態</th></tr></thead><tbody id="unitTable"></tbody></table></div></article>
      <div class="dashboard-grid dashboard-section"><article class="card"><div class="card-head"><h2>各單位占床率</h2></div><div class="card-body"><div class="chart" id="occupancyChart"></div></div></article><article class="card"><div class="card-head"><h2>待完成填報</h2></div><div class="card-body"><div class="side-list" id="pendingList"></div></div></article></div>
      <article class="card dashboard-section"><div class="card-head"><div><h2>異常與漏填紀錄</h2><small style="color:var(--muted)">優先顯示過去未填寫、僅暫存及缺少必要欄位的資料</small></div><span class="status draft" id="alertCount">0 筆待處理</span></div><div class="table-wrap"><table><thead><tr><th>日期</th><th>班別</th><th>單位</th><th>異常類型</th><th>異常內容</th><th>處理狀態</th></tr></thead><tbody id="alertTable"></tbody></table></div></article>
      <article class="card dashboard-section"><div class="card-head"><h2>異常通報判定規則</h2></div><div class="card-body"><div class="formula">漏填異常：過去班別沒有紀錄、只有暫存、實際上班人力或必填事件欄位缺值。營運提醒：住院人數超過有效床數。住院人數與空床數由系統自動計算，不列為人工填報異常；數字 0 是有效資料，也不視為漏填。</div></div></article>
    </section>
    <section id="accountsView" class="hidden">
      <article class="card"><div class="card-head"><h2>帳號管理</h2><button class="btn btn-soft" id="reloadAccounts">重新整理帳號</button></div><div class="card-body"><label><input id="registrationOpen" type="checkbox"> 開放 NROP 新帳號申請</label><p>新申請預設待審核。停用只影響 NROP 的存取資格。</p><div id="accountFeedback" class="notice hidden" role="status"></div></div>
      <div class="table-wrap"><table><thead><tr><th>姓名／Email</th><th>申請單位</th><th>角色</th><th>核准單位</th><th>狀態</th><th>操作</th></tr></thead><tbody id="accountTable"></tbody></table></div></article>
      <article class="card dashboard-section"><div class="card-head"><h2>最近 100 筆操作紀錄</h2></div><div class="table-wrap"><table><thead><tr><th>時間</th><th>操作</th><th>對象</th><th>操作者</th></tr></thead><tbody id="auditTable"></tbody></table></div></article>
    </section>
    <div class="footnote">資料儲存於 Supabase · 正式與 DEMO 分區 · 人力可填至小數點第三位</div>
  </main>
  <dialog id="accountDialog"><form id="joinForm" class="hidden"><h2>NROP 存取申請</h2><p>此 Email 已登入 Supabase，請申請 NROP 平台權限。</p><div class="field"><label for="joinName">姓名</label><input id="joinName" required maxlength="80"></div><div class="field"><label for="joinUnit">申請單位</label><select id="joinUnit"></select></div><button class="btn btn-primary" type="submit">送出申請</button></form><div id="membershipNotice"></div><button type="button" class="btn btn-soft" id="membershipRefresh">重新檢查核准狀態</button><button type="button" class="btn btn-soft" id="membershipLogout">登出</button></dialog>
  <dialog id="passwordDialog"><form id="passwordForm"><h2>設定新密碼</h2><p>至少 12 碼，包含英文與數字；共用 Supabase 帳號的其他平台也會使用此密碼。</p><div class="field"><label for="newPassword">新密碼</label><input id="newPassword" type="password" autocomplete="new-password" required minlength="12"></div><div class="field"><label for="confirmPassword">再次輸入新密碼</label><input id="confirmPassword" type="password" autocomplete="new-password" required minlength="12"></div><div id="passwordMessage" class="notice hidden" role="status"></div><button class="btn btn-primary" type="submit">更新密碼</button> <button class="btn btn-soft" id="cancelPassword" type="button">取消</button></form></dialog>
  <div id="toast" class="toast hidden"></div>

  <script type="module" src="/src/main.js"></script>
</body>
</html>

```

## 修改後：assets/theme.css（完整）

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

/* Supabase authentication and account management */
button:disabled { opacity: .55; cursor: wait; transform: none; }
.btn-link { background: transparent; color: #075a9d; box-shadow: none; }
.auth-tabs { margin-bottom: 20px; }
.login-form form > p { color: var(--muted); line-height: 1.7; }
.notice.error { color: #8c2020; background: #fff2f2; border-color: #e6b5b5; }
.platform-tools { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-bottom: 16px; }
.platform-tools label { font-weight: 700; }
.platform-tools select, #accountTable select, #openingPatients { font: inherit; padding: 9px; border: 1px solid var(--input-line); border-radius: 8px; background: #fff; max-width: 100%; }
#syncStatus { color: var(--muted); font-size: 13px; }
#accountTable td { vertical-align: middle; }
#accountTable select { min-width: 100px; }
dialog { width: min(480px, calc(100vw - 32px)); border: 1px solid var(--line); padding: 28px; border-radius: 18px; color: var(--text); box-shadow: 0 24px 80px #001b4455; }
dialog::backdrop { background: #001b44aa; }
dialog h2 { color: var(--navy); margin-top: 0; }
dialog p { line-height: 1.7; }
#openingPatients { width: 110px; }
#openingControls p { margin-top: 0; }
#membershipNotice { line-height: 1.8; margin-bottom: 18px; }
@media (max-width: 700px) { .top-actions { flex-wrap: wrap; justify-content: flex-end; gap: 7px; } .top-actions .btn { padding: 7px; font-size: 12px; } .user-chip { font-size: 12px; } .platform-tools { align-items: stretch; } }

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

## 修改後：src/main.js（完整）

```javascript
import { supabase, rpc, errorMessage } from './api.js';
import { units, operationalUnits, allLoginUnits } from './catalog.js';
import { RecordStore, dateOffset, escapeHtml as esc } from './record-store.js';
import { $, $$, today } from './dom.js';
import { createReporting } from './report-renderers.js';

const roles={unit:'平台使用者',admin:'一般管理者',sysadmin:'系統管理者'};
const statuses={pending:'待審核',active:'啟用',disabled:'停用'};
let session=null, dataset='live', config=null, busy=false, loading=false, authEpoch=0, accountRows=[], passwordRecovery=false;
const store=new RecordStore(rpc,new Set(operationalUnits.map(u=>u.id)));
const reporting=createReporting({store,persistRecord,alertFrom});
const feedback=(selector,message,error=false)=>{const el=$(selector);el.textContent=message;el.classList.toggle('hidden',!message);el.classList.toggle('error',error);};
function toast(message){feedback('#toast',message);clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').classList.add('hidden'),4500);}
function setDates(date){['#entryDate','#specialDate','#dashboardDate'].forEach(id=>$(id).value=date);}
function alertFrom(){
 const date=$('#dashboardDate').value;
 const start=[dateOffset(date,-30),dataset==='demo'?(config?.demoStartDate||date):(config?.liveStartDate||date)].sort().at(-1);
 return start>date?date:start;
}
function syncControls(){
 const disabled=busy||loading;
 ['#saveDraft','#submitRecord','#saveSpecialDraft','#submitSpecialRecord','#setOpening','#datasetSelect','#managedUnit',
 '#entryDate','#entryShift','#specialDate','#specialShift','#dashboardDate','#dashboardShift','#refreshData'].forEach(id=>$(id).disabled=disabled);
}
async function loadConfig(){
 config=await rpc('nrop_public_config');
 if(!config?.units?.length)throw new Error('資料庫尚無單位設定，請執行完整 INSTALL.sql。');
 for(const serverUnit of config.units){const local=allLoginUnits.find(u=>u.id===serverUnit.id);if(local)local.beds=serverUnit.beds;}
 ['#registerUnit','#joinUnit','#managedUnit'].forEach(id=>$(id).innerHTML=config.units.map(u=>`<option value="${esc(u.id)}">${esc(u.id)}</option>`).join(''));
 document.querySelector('[data-auth="register"]').disabled=!config.registrationOpen;
 feedback('#connectionStatus',`已連線 Supabase${config.registrationOpen?'':' · 目前暫停新帳號申請'}`);
}
async function refreshData(){
 if(!session||loading)return false;
 const view=document.querySelector('.tab.active')?.dataset.view||'entry';
 loading=true;syncControls();feedback('#appError','');$('#syncStatus').textContent='讀取中…';
 $('#entryView').classList.add('hidden');$('#dashboardView').classList.add('hidden');
 try{
  // 三個日期欄位同步，查詢含前一天基準及最近 30 天異常，無每次載入全部歷史資料。
  const date=$('#dashboardDate').value;
  const from=[alertFrom(),dateOffset(date,-1)].sort()[0];
  if(!await store.load(dataset,from,date))return false;
  reporting.render(session,dataset);
  showView(view);
  $('#syncStatus').textContent='已從 Supabase 更新 '+new Date().toLocaleTimeString('zh-TW');
  return true;
 }catch(error){
  feedback('#appError',errorMessage(error),true);$('#syncStatus').textContent='讀取失敗，請重試';
  // 資料快取失效時遮蔽舊表格，避免誤認為資料庫的最新內容。
  $('#entryView').classList.add('hidden');$('#dashboardView').classList.add('hidden');
  if(error.code==='42501')setTimeout(()=>void resolveMembership(),0);
  return false;
 }finally{loading=false;syncControls();}
}
async function persistRecord(status,payload,special){
 if(busy||loading||!session)return false;
 busy=true;syncControls();feedback('#appError','');
 const date=$(special?'#specialDate':'#entryDate').value,shift=$(special?'#specialShift':'#entryShift').value;
 const key=`${special?'OPS|':''}${date}|${shift}|${session.unit}`,version=store.get()[key]?.version||0;
 try{
  await rpc('nrop_save_record',{p_dataset:dataset,p_date:date,p_shift:shift,p_unit:session.unit,p_payload:payload,p_status:status,p_version:version});
  const refreshed=await refreshData();toast(refreshed?(status==='draft'?'已暫存至 Supabase':'已正式送出至 Supabase'):'資料已儲存，但重新讀取失敗，請按重新整理');return true;
 }catch(error){
  feedback('#appError',errorMessage(error),true);
  if(error.code==='40001')toast('版本有衝突。請先保留畫面上的內容，再按重新整理比對。');
  if(error.code==='42501')await resolveMembership();
  return false;
 }finally{busy=false;syncControls();}
}
function showView(view){
 if(!session)return;
 if(view==='accounts'&&session.role!=='sysadmin')return;
 if(view==='dashboard'&&session.role==='unit')return;
 ['entry','dashboard','accounts'].forEach(name=>$('#'+name+'View').classList.toggle('hidden',view!==name));
 $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===view));
 $('#pageTitle').textContent={entry:'單位每日填報',dashboard:'全院當日動態',accounts:'帳號管理'}[view];
 if(view==='accounts')void loadAccounts();
}
async function openApp(member){
 const sameUser=session?.userId===member.userId;
 const managedUnit=sameUser?session.unit:units[0].id;
 session={...member,unit:member.role==='unit'?member.unit:(managedUnit||units[0].id)};
 $('#accountDialog').close();$('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden');$('#sessionArea').hidden=false;
 $('#userChip').textContent=`${member.name}｜${roles[member.role]}${member.role==='unit'?'｜'+member.unit:''}`;
 $('#pageSubtitle').textContent=member.role==='unit'?`${member.unit} 單位資料僅供授權人員填寫`:'依權限管理全院填報資料；異常紀錄顯示所選日期之前最多 30 天';
 document.querySelector('[data-view="dashboard"]').classList.toggle('hidden',member.role==='unit');
 document.querySelector('[data-view="accounts"]').classList.toggle('hidden',member.role!=='sysadmin');
 $('#managedUnitField').classList.toggle('hidden',member.role==='unit');$('#managedUnit').value=session.unit;
 $('#currentUnit').textContent=session.unit;
 if(!sameUser){setDates(today());dataset='live';$('#datasetSelect').value='live';}
 updateDatasetNotice();showView('entry');await refreshData();
}
function updateDatasetNotice(){feedback('#datasetNotice',dataset==='demo'?'DEMO 測試資料：所有數字均為虛擬範例，儲存修改也只影響 DEMO 區，不列入正式營運。':'正式填報：此區僅顯示實際填報紀錄，沒有資料的日期不會自動補示範數字。');}
function clearApp(){
 session=null;store.clear();accountRows=[];$('#accountTable').replaceChildren();$('#auditTable').replaceChildren();
 reporting.clear();
 $('#appView').classList.add('hidden');$('#loginView').classList.remove('hidden');$('#sessionArea').hidden=true;
 $('#accountDialog').close();$('#passwordDialog').close();
}
async function logout(){
 authEpoch++;passwordRecovery=false;clearApp();
 if(supabase){const {error}=await supabase.auth.signOut({scope:'local'});if(error)feedback('#authMessage',errorMessage(error),true);}
 $('#password').value='';
}
async function resolveMembership(){
 const epoch=++authEpoch;
 try{
  if(!supabase)throw new Error('請先設定 .env.local');
  const {data,error}=await supabase.auth.getSession();if(error)throw error;
  if(!data.session){if(epoch===authEpoch)clearApp();return;}
  if(passwordRecovery)return;
  const member=await rpc('nrop_current_account');
  if(epoch!==authEpoch)return;
  if(member?.status==='active'&&member.emailVerified!==false){await openApp(member);return;}
  clearApp();$('#sessionArea').hidden=false;$('#userChip').textContent=data.session.user.email;
  $('#joinForm').classList.toggle('hidden',!!member||!config?.registrationOpen);
  $('#membershipNotice').textContent=member?.emailVerified===false?'請先完成 Email 驗證。':member?`${member.name}：${statuses[member.status]}。${member.status==='pending'?'請等待系統管理者核准。':'如需重新啟用，請聯絡系統管理者。'}`
    :config?.registrationOpen?'請填寫申請資料；既有 Supabase 帳號不會自動取得 NROP 權限。':'目前尚無 NROP 資格，且暫停新帳號申請。';
  const metadata=data.session.user.user_metadata||{};
  $('#joinName').value=metadata.display_name||'';if(metadata.requested_unit)$('#joinUnit').value=metadata.requested_unit;
  if(!$('#accountDialog').open)$('#accountDialog').showModal();
 }catch(error){clearApp();feedback('#authMessage',errorMessage(error),true);}
}
async function authAction(form,action){
 const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);feedback('#authMessage','');
 try{await action();}catch(error){feedback('#authMessage',errorMessage(error),true);}finally{buttons.forEach(b=>b.disabled=false);}
}
function validPassword(value){return value.length>=12&&/[A-Za-z]/.test(value)&&/[0-9]/.test(value);}
$('#loginForm').onsubmit=e=>{e.preventDefault();void authAction(e.currentTarget,async()=>{
 if(!config)await loadConfig();
 const {error}=await supabase.auth.signInWithPassword({email:$('#account').value.trim(),password:$('#password').value});
 if(error)throw error;$('#password').value='';await resolveMembership();
});};
$('#registerForm').onsubmit=e=>{e.preventDefault();void authAction(e.currentTarget,async()=>{
 if(!config)await loadConfig();if(!config.registrationOpen)throw new Error('目前未開放新帳號申請');
 const password=$('#registerPassword').value;if(!validPassword(password))throw new Error('密碼至少 12 碼，包含英文與數字');
 const name=$('#registerName').value.trim(),unit=$('#registerUnit').value;
 const {data,error}=await supabase.auth.signUp({email:$('#registerEmail').value.trim(),password,options:{data:{display_name:name,requested_unit:unit},emailRedirectTo:location.origin}});
 if(error)throw error;$('#registerPassword').value='';
 if(data.session){await rpc('nrop_request_access',{p_name:name,p_unit:unit});await resolveMembership();}
 else feedback('#authMessage','請至 Email 收取驗證信；完成後登入，再確認送出 NROP 申請。若此 Email 已有帳號，請直接登入。');
});};
$('#joinForm').onsubmit=e=>{e.preventDefault();void authAction(e.currentTarget,async()=>{
 await rpc('nrop_request_access',{p_name:$('#joinName').value.trim(),p_unit:$('#joinUnit').value});await resolveMembership();
});};
$('#membershipRefresh').onclick=()=>void resolveMembership();$('#membershipLogout').onclick=()=>void logout();$('#logoutBtn').onclick=()=>void logout();
$('#accountDialog').addEventListener('cancel',e=>e.preventDefault());
$$('[data-auth]').forEach(button=>button.onclick=()=>{
 $$('[data-auth]').forEach(b=>b.classList.toggle('active',b===button));$('#loginForm').classList.toggle('hidden',button.dataset.auth!=='login');
 $('#registerForm').classList.toggle('hidden',button.dataset.auth!=='register');feedback('#authMessage','');
});
$('#forgotPassword').onclick=()=>void authAction($('#loginForm'),async()=>{
 if(!$('#account').reportValidity())return;
 const {error}=await supabase.auth.resetPasswordForEmail($('#account').value.trim(),{redirectTo:location.origin});
 if(error)throw error;feedback('#authMessage','若此 Email 可接收重設信，系統將寄送連結。未收到時請聯絡管理者確認 SMTP 設定。');
});
$('#changePasswordBtn').onclick=()=>{$('#passwordForm').reset();feedback('#passwordMessage','');$('#passwordDialog').showModal();};
$('#cancelPassword').onclick=()=>{$('#passwordDialog').close();passwordRecovery=false;void resolveMembership();};
$('#passwordForm').onsubmit=e=>{e.preventDefault();void(async()=>{
 const password=$('#newPassword').value;
 if(!validPassword(password)){feedback('#passwordMessage','密碼至少 12 碼，包含英文與數字',true);return;}
 if(password!==$('#confirmPassword').value){feedback('#passwordMessage','兩次密碼不同',true);return;}
 const button=e.currentTarget.querySelector('[type="submit"]');button.disabled=true;
 try{const {error}=await supabase.auth.updateUser({password});if(error)throw error;$('#passwordDialog').close();$('#passwordForm').reset();toast('密碼已更新，請重新登入');await logout();}
 catch(error){feedback('#passwordMessage',errorMessage(error),true);}finally{button.disabled=false;}
})();};

$$('.tab').forEach(t=>t.onclick=()=>showView(t.dataset.view));
$('#datasetSelect').onchange=async()=>{dataset=$('#datasetSelect').value;store.clear();setDates(dataset==='demo'?(config.demoLatestDate||today()):today());updateDatasetNotice();await refreshData();};
$('#managedUnit').onchange=()=>{session.unit=$('#managedUnit').value;$('#currentUnit').textContent=session.unit;reporting.render(session,dataset);};
['#entryDate','#specialDate','#dashboardDate'].forEach(id=>{
 $(id).value=today();$(id).max=today();$(id).onchange=async()=>{if(!$(id).reportValidity()||!$(id).value)return;setDates($(id).value);await refreshData();};
});
['#entryShift','#specialShift','#dashboardShift'].forEach(id=>$(id).onchange=()=>reporting.render(session,dataset));
$('#refreshData').onclick=async()=>{await refreshData();if(!$('#appError').textContent)showView(document.querySelector('.tab.active')?.dataset.view||'entry');};
$('#setOpening').onclick=async()=>{
 if(!$('#openingPatients').reportValidity()||busy||loading)return;
 busy=true;syncControls();
 try{await rpc('nrop_set_opening',{p_dataset:dataset,p_unit:session.unit,p_date:$('#entryDate').value,p_shift:$('#entryShift').value,p_patients:Number($('#openingPatients').value)});await refreshData();toast('期初住院人數已儲存');}
 catch(error){feedback('#appError',errorMessage(error),true);}finally{busy=false;syncControls();}
};

async function loadAccounts(){
 try{
  const [accounts,currentConfig,audit]=await Promise.all([rpc('nrop_admin_accounts'),rpc('nrop_public_config'),rpc('nrop_admin_audit')]);
  if(session?.role!=='sysadmin')return;
  accountRows=accounts;config=currentConfig;$('#registrationOpen').checked=config.registrationOpen;
  $('#accountTable').innerHTML=accounts.map((a,i)=>`<tr data-index="${i}"><td><b>${esc(a.name)}</b><br>${esc(a.email)}</td><td>${esc(a.requestedUnit)}</td>
    <td><select data-account="role" aria-label="角色">${Object.entries(roles).map(([value,label])=>`<option value="${value}"${a.role===value?' selected':''}>${label}</option>`).join('')}</select></td>
    <td><select data-account="unit" aria-label="核准單位"><option value="">不指定（管理者）</option>${config.units.map(u=>`<option value="${esc(u.id)}"${a.unit===u.id?' selected':''}>${esc(u.id)}</option>`).join('')}</select></td>
    <td><select data-account="status" aria-label="狀態">${Object.entries(statuses).map(([value,label])=>`<option value="${value}"${a.status===value?' selected':''}>${label}</option>`).join('')}</select></td>
    <td><button class="btn btn-primary" data-save-account="${i}">儲存</button></td></tr>`).join('');
  $('#auditTable').innerHTML=audit.map(a=>`<tr><td>${esc(new Date(a.created_at).toLocaleString('zh-TW'))}</td><td>${esc(a.action)}</td><td>${esc(a.target)}</td><td>${esc(accounts.find(x=>x.userId===a.actor_id)?.name||a.actor_id||'資料庫管理者')}</td></tr>`).join('');
  $$('[data-save-account]').forEach(button=>button.onclick=async()=>{
   button.disabled=true;const i=Number(button.dataset.saveAccount),a=accountRows[i],row=button.closest('tr');
   try{
    const role=row.querySelector('[data-account="role"]').value,unit=row.querySelector('[data-account="unit"]').value||null;
    if(role==='unit'&&!unit)throw new Error('平台使用者必須指定所屬單位');
    await rpc('nrop_admin_update_account',{p_user:a.userId,p_role:role,p_status:row.querySelector('[data-account="status"]').value,p_unit:unit,p_version:a.version});
    feedback('#accountFeedback','帳號設定已儲存');
    if(a.userId===session?.userId)await resolveMembership();else await loadAccounts();
   }catch(error){feedback('#accountFeedback',errorMessage(error),true);}finally{button.disabled=false;}
  });
 }catch(error){feedback('#accountFeedback',errorMessage(error),true);}
}
$('#reloadAccounts').onclick=()=>void loadAccounts();
$('#registrationOpen').onchange=async()=>{
 const checkbox=$('#registrationOpen');checkbox.disabled=true;
 try{await rpc('nrop_admin_set_registration',{p_open:checkbox.checked});await loadAccounts();feedback('#accountFeedback','申請開關已更新');}
 catch(error){checkbox.checked=!checkbox.checked;feedback('#accountFeedback',errorMessage(error),true);}finally{checkbox.disabled=false;}
};

async function init(){
 try{
  if(!supabase)throw new Error('請先依 README 設定 .env.local，並用 npm run dev 啟動。');
  supabase.auth.onAuthStateChange(event=>{
   if(event==='SIGNED_OUT'){authEpoch++;clearApp();}
   if(event==='PASSWORD_RECOVERY'){passwordRecovery=true;setTimeout(()=>{$('#accountDialog').close();if(!$('#passwordDialog').open)$('#passwordDialog').showModal();},0);}
   // 不在 Auth 的同步 callback 裡呼叫其他 Auth 方法，避免鎖死工作階段。
  });
  await loadConfig();await resolveMembership();
 }catch(error){feedback('#connectionStatus',errorMessage(error),true);}
}
void init();

```

## 修改後：src/api.js（完整）

```javascript
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key, {
  auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, flowType: 'pkce' },
  global: { fetch: (input,init={})=>fetch(input,{...init,signal:init.signal||AbortSignal.timeout(15000)}) }
}) : null;

export async function rpc(name, params = {}) {
  if (!supabase) throw new Error('尚未設定 Supabase，請參閱安裝說明設定 .env.local。');
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}

export function errorMessage(error) {
  const message = error?.message || '連線失敗，請稍後再試。';
  if (/Invalid login credentials/i.test(message)) return 'Email 或密碼錯誤。';
  if (/Email not confirmed/i.test(message)) return '請先完成 Email 驗證。';
  if (/Failed to fetch|NetworkError|fetch failed|503|Site not available|Unexpected token|timed out|aborted/i.test(message)) return 'Supabase 暫時無法連線，請檢查服務狀態後重試。';
  if (/Could not find the function|schema cache/i.test(message)) return '尚未安裝 NROP 資料庫，請先在 SQL Editor 執行 INSTALL.sql。';
  if (/rate limit/i.test(message)) return '嘗試次數過多，請稍後再試。';
  if (/signups not allowed/i.test(message)) return 'Supabase 尚未開放註冊，請聯絡系統管理者。';
  return message.length > 240 ? '操作失敗，請檢查服務狀態或聯絡系統管理者。' : message;
}

```

## 修改後：src/dom.js（完整）

```javascript
export const $=s=>document.querySelector(s);
export const $$=s=>[...document.querySelectorAll(s)];
export function today() {return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}

```

## 修改後：src/record-store.js（完整）

```javascript
export function dateOffset(date, days) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function recordKey(row, operationalIds) {
  return `${operationalIds.has(row.unit) ? 'OPS|' : ''}${row.date}|${row.shift}|${row.unit}`;
}
// 純記憶體快取。讀取失敗即清空，不回退至舊 localStorage 或其他使用者的資料。
export class RecordStore {
  constructor(rpc, operationalIds) { this.rpc=rpc; this.operationalIds=operationalIds; this.data={}; this.openings=[]; this.generation=0; }
  get() { return this.data; }
  clear() { this.generation++; this.data={}; this.openings=[]; }
  async load(dataset, from, to) {
    const generation=++this.generation;
    try {
      const [rows,openings]=await Promise.all([
        this.rpc('nrop_list_records',{p_dataset:dataset,p_from:from,p_to:to}),
        this.rpc('nrop_list_openings',{p_dataset:dataset})
      ]);
      if(generation!==this.generation) return false;
      this.data=Object.fromEntries(rows.map(row=>[recordKey(row,this.operationalIds),row.record]));
      this.openings=openings;
      return true;
    } catch(error) { if(generation===this.generation){this.data={};this.openings=[];} throw error; }
  }
}

export function escapeHtml(value) {
  return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

```

## 修改後：src/catalog.js（完整）

```javascript
export const units=[
  {id:'6A',beds:39,type:'ward'},{id:'6B',beds:43,type:'ward'},{id:'7A',beds:45,type:'ward'},{id:'7B',beds:45,type:'ward'},{id:'8A',beds:32,type:'ward'},{id:'安寧病房',beds:10,type:'ward'},{id:'8B',beds:33,type:'ward'},{id:'9A',beds:45,type:'ward'},{id:'9B',beds:45,type:'ward'},{id:'10A',beds:45,type:'ward'},{id:'10B',beds:45,type:'ward'},{id:'11A',beds:40,type:'ward'},{id:'11B',beds:45,type:'ward'},{id:'12B',beds:10,type:'ward'},{id:'精神科急性病房',beds:30,type:'ward'},
  {id:'ICU-1',beds:12,type:'special'},{id:'ICU-2',beds:24,type:'special'},{id:'ICU-3',beds:9,type:'special'},{id:'NICU',beds:3,type:'special'},{id:'PICU',beds:2,type:'special'},{id:'BR',beds:10,type:'special'},{id:'NBC',beds:10,type:'special'},{id:'燙傷中心',beds:4,type:'special'}
];
export const operationalUnits=[
  {id:'急診',beds:33,type:'emergency',fields:[['staff','實際上班人力'],['visits','來診人數'],['referralIn','轉診入'],['referralOut','轉診出'],['admitted','住院'],['observation','留觀'],['deaths','死亡'],['surgeries','手術']]},
  {id:'產房',beds:6,type:'delivery',fields:[['staff','實際上班人力'],['visits','來診人數'],['observation','留觀'],['waiting','待產'],['cesarean','剖腹產'],['naturalBirth','自然產'],['drSurgery','DR 手術']]},
  {id:'手術室',beds:11,type:'operatingRoom',fields:[['staff','實際上班人力'],['inCount','IN'],['outCount','OUT']]},
  {id:'護理之家',beds:39,type:'nursingHome',fields:[['nurseStaff','護理師'],['aideStaff','護佐'],['staff','上班人力（自動合計）'],['residents','機構內住民人數'],['occupiedBeds','實際使用床數'],['reserved','保留床位'],['admitted','住院'],['discharged','出院']]},
  {id:'洗腎室',beds:61,type:'dialysis',fields:[['staff','實際上班人力'],['hemodialysisOutpatient','血液透析－門診'],['hemodialysisInpatient','血液透析－住院'],['hemodialysisCritical','血液透析－重症'],['peritonealDialysis','腹膜透析病人數']]}
];
export const allLoginUnits=[...units,...operationalUnits];
export const nursingHomeStaffFields=['nurseStaff','aideStaff'],specialStaffFields=['staff',...nursingHomeStaffFields];
export const shifts=['N','D','E'], events=['住院','出院','轉入','轉出','病危','死亡'];
export const specialtyAdmissions=[['住院本科','住院（本科）'],['住院非本科','住院（非本科）']],isolationAdmissions=[['住院一般病房','住院（一般病房）'],['住院負壓隔離','住院（負壓隔離）']];
const admissionFieldsByUnit={'6A':specialtyAdmissions,'6B':specialtyAdmissions,'12B':isolationAdmissions,'ICU-3':isolationAdmissions};
export const admissionExportFields=[...specialtyAdmissions,...isolationAdmissions];

export { admissionFieldsByUnit };

```

## 修改後：src/report-renderers.js（完整）

```javascript
import { units, operationalUnits, allLoginUnits, nursingHomeStaffFields, specialStaffFields, shifts, events, admissionFieldsByUnit, admissionExportFields } from './catalog.js';
import { $, $$, today } from './dom.js';
export function createReporting({store,persistRecord,alertFrom}) {
let session=null,dataset='live';
    function organizeDashboard(){
      const dashboard=$('#dashboardView'),shiftPanel=$('#shiftPanel'),dailyPanel=$('#dailyPanel'),alertsPanel=$('#alertsPanel'),content=[...dashboard.children].slice(5);
      const [dailySummary,shiftLabel,shiftMetrics,closingSummary,unitStats,shiftCharts,alertLog,alertRules]=content;
      dailyPanel.prepend(dailySummary,closingSummary);shiftPanel.append(shiftLabel,shiftMetrics,unitStats,shiftCharts);alertsPanel.append(alertLog,alertRules);
      $$('.subtab').forEach(btn=>btn.onclick=()=>{$$('.subtab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');[shiftPanel,dailyPanel,alertsPanel].forEach(p=>p.classList.toggle('hidden',p.id!==btn.dataset.panel));$('#dashboardShift').classList.toggle('hidden',btn.dataset.panel!=='shiftPanel')});
    }
    organizeDashboard();
const eventLabels={轉入:'機構內轉入',轉出:'機構內轉出',病危:'病危（不列入計算）'};
function entryEventFields(unit){return events.flatMap(n=>n==='住院'&&admissionFieldsByUnit[unit]?admissionFieldsByUnit[unit]:[[n,eventLabels[n]||n]])}
function admissionTotal(record,unit){
  const fields=admissionFieldsByUnit[unit];
  return fields&&fields.every(([field])=>record[field]!==undefined&&record[field]!==null&&record[field]!=='')?fields.reduce((sum,[field])=>sum+(Number(record[field])||0),0):record.住院||0;
}
function renderEventFields(record){
  const split=admissionFieldsByUnit[session.unit]||[],needsBreakdown=(record.住院||0)>0&&split.some(([field])=>record[field]===undefined||record[field]===null||record[field]==='');
  $('#eventFields').innerHTML=entryEventFields(session.unit).map(([field,label])=>{
    const isAdmissionPart=split.some(([name])=>name===field),value=record[field]??(isAdmissionPart&&needsBreakdown?'':0);
    return `<div class="number-field"><label>${label}</label><input class="event-input" data-event="${field}" type="number" min="0" step="1" required value="${value}"${isAdmissionPart?' data-admission-part':''}></div>`;
  }).join('');
  $$('.event-input').forEach(input=>input.oninput=calculate);
}

$('#staff').oninput=calculate;
function key(date,shift,unit){return `${date}|${shift}|${unit}`}
function previousKey(date,shift,unit){let d=new Date(date+'T12:00:00'),s;if(shift==='N'){d.setDate(d.getDate()-1);s='E'}else{s=shift==='D'?'N':'D'}return key(d.toISOString().slice(0,10),s,unit)}
function emptyRecord(){return{staff:0,住院:0,出院:0,轉入:0,轉出:0,病危:0,死亡:0,status:'empty'}}
function getBase(){
  const date=$('#entryDate').value,shift=$('#entryShift').value,data=store.get(),prior=data[previousKey(date,shift,session.unit)];
  const opening=store.openings.find(x=>x.unit_id===session.unit&&x.report_date===date&&x.shift===shift);
  const current=data[key(date,shift,session.unit)];
  return {value:prior?.patients??opening?.patients??current?.opening??0,ready:prior?.status==='submitted'||!!opening};
}
function renderEntry(){
  const operational=operationalUnits.find(x=>x.id===session.unit);
  $('#standardEntryGrid').classList.toggle('hidden',!!operational);$('#specialEntryView').classList.toggle('hidden',!operational);
  if(operational){renderSpecialForm();return}
  const u=units.find(x=>x.id===session.unit),data=store.get(),rec=data[key($('#entryDate').value,$('#entryShift').value,session.unit)]||emptyRecord(),base=getBase();
  $('#bedCount').textContent=u.beds;$('#openingControls').classList.toggle('hidden',session.role==='unit'||Object.keys(data).some(k=>k.endsWith('|'+session.unit)));$('#staff').value=rec.staff??'';renderEventFields(rec);$('#previous').value=base.value;
  $('#previousNotice').classList.toggle('hidden',base.ready);$('#previousNotice').textContent='前一班尚未正式送出，目前可暫存；前班完成後系統將依最新資料重新計算。';
  setStatus(rec.status);calculate();renderProgress();
}
function operationalKey(date,shift,unit){return `OPS|${date}|${shift}|${unit}`}
function hasNursingHomeStaffSplit(record){return nursingHomeStaffFields.every(field=>record[field]!==undefined&&record[field]!==null&&record[field]!=='')}
function nursingHomeStaff(record){return hasNursingHomeStaffSplit(record)?nursingHomeStaffFields.reduce((sum,field)=>sum+Math.round((Number(record[field])||0)*1000),0)/1000:record.staff||0}
function renderSpecialForm(){
  const u=operationalUnits.find(x=>x.id===session.unit),data=store.get(),rec=data[operationalKey($('#specialDate').value,$('#specialShift').value,u.id)]||{status:'empty'};
  $('#specialFormTitle').textContent=`${u.id}每日動態填報`;$('#specialCurrentUnit').textContent=u.id;$('#specialBeds').textContent=`${u.beds} 床`;
  const isNursingHome=u.type==='nursingHome',needsBreakdown=isNursingHome&&!hasNursingHomeStaffSplit(rec)&&(rec.staff||0)>0;
  $('#specialFields').innerHTML=u.fields.map(([field,label])=>{
    const isStaff=specialStaffFields.includes(field),isPart=isNursingHome&&nursingHomeStaffFields.includes(field),isTotal=isNursingHome&&field==='staff',value=isTotal?nursingHomeStaff(rec):rec[field]??(isPart&&needsBreakdown?'':0);
    return `<div class="number-field"><label>${label}</label><input class="special-input" data-field="${field}" type="number" min="0" step="${isStaff?'0.001':'1'}" inputmode="${isStaff?'decimal':'numeric'}" value="${value}" required${isPart?' data-staff-part':''}${isTotal?' readonly':''}></div>`;
  }).join('');
  $('#staffBreakdownNotice').classList.add('hidden');
  if(isNursingHome){$$('.special-input[data-staff-part]').forEach(input=>input.oninput=updateNursingHomeStaff);updateNursingHomeStaff()}
  const el=$('#specialRecordStatus'),text=rec.status==='submitted'?'已完成':rec.status==='draft'?'已暫存':'尚未填寫';el.className=`status ${rec.status||'empty'}`;el.textContent=text;
}
function updateNursingHomeStaff(){
  const inputs=$$('.special-input[data-staff-part]'),complete=inputs.every(input=>input.value!==''&&input.validity.valid),record=store.get()[operationalKey($('#specialDate').value,$('#specialShift').value,session.unit)]||{};
  const parts=Object.fromEntries(inputs.map(input=>[input.dataset.field,Number(input.value)]));
  $('.special-input[data-field="staff"]').value=formatStaff(complete?nursingHomeStaff(parts):nursingHomeStaff(record));
  $('#staffBreakdownNotice').classList.toggle('hidden',complete);$('#staffBreakdownNotice').textContent=`請填齊護理師與護佐人力，均可輸入至小數點後三位，無此職類請填 0。分類未完成前保留原紀錄上班人力 ${formatStaff(nursingHomeStaff(record))}，補填後再儲存。`;
}

async function saveSpecial(status){
  if(!$$('.special-input').every(input=>input.reportValidity()))return;
  const record={};
  $$('.special-input').forEach(input=>record[input.dataset.field]=Number(input.value));
  await persistRecord(status,record,true);
}
$('#saveSpecialDraft').onclick=()=>saveSpecial('draft');$('#submitSpecialRecord').onclick=()=>saveSpecial('submitted');
function values(){
  const v={staff:Math.max(0,parseFloat($('#staff').value)||0)},split=admissionFieldsByUnit[session.unit]||[];
  entryEventFields(session.unit).forEach(([field])=>{const input=document.querySelector(`[data-event="${field}"]`);v[field]=input.value===''&&split.some(([name])=>name===field)?null:Math.max(0,parseInt(input.value)||0)});
  if(split.length){const record=store.get()[key($('#entryDate').value,$('#entryShift').value,session.unit)]||emptyRecord();v.住院=admissionTotal({...record,...v},session.unit)}
  return v;
}
function calculate(){
  const v=values(),base=getBase().value,beds=units.find(x=>x.id===session.unit).beds,patients=base+v.住院-v.出院+v.轉入-v.轉出-v.死亡,split=admissionFieldsByUnit[session.unit]||[],incomplete=split.some(([field])=>v[field]===null);
  $('#patientCount').textContent=patients;$('#emptyBeds').textContent=Math.max(beds-patients,0);$('#overBeds').textContent=Math.max(patients-beds,0);
  $('#admissionSummary').classList.toggle('hidden',!split.length);$('#admissionSummary').textContent=`住院合計：${v.住院} 人次（${incomplete?'暫沿用原紀錄，請補填分類':'兩欄相加，計入當班住院病人數'}）`;
  $('#admissionNotice').classList.toggle('hidden',!incomplete);$('#admissionNotice').textContent=`原紀錄住院合計 ${v.住院} 人次，尚未完成分類。請補填兩欄後再儲存，無此類住院請填 0。`;
}
function validateEntry(){return $('#staff').reportValidity()&&$$('.event-input').every(input=>input.reportValidity())}
function setStatus(s){const el=$('#recordStatus'),map={empty:'尚未填寫',draft:'已暫存',submitted:'已完成'};el.className=`status ${s}`;el.textContent=map[s]}
async function save(status){
  if(!validateEntry())return false;
  return persistRecord(status,values(),false);
}
$('#saveDraft').onclick=()=>save('draft');
$('#submitRecord').onclick=()=>{if(!getBase().ready){void save('draft').then(ok=>{if(ok)toast('前班未完成，已先暫存；第一班請管理者設定期初人數')})}else void save('submitted')};
function renderProgress(){const data=store.get(),date=$('#entryDate').value;$('#shiftProgress').innerHTML=shifts.map(s=>{const r=data[key(date,s,session.unit)]||emptyRecord(),txt=r.status==='submitted'?'已完成':r.status==='draft'?'已暫存':'待填報';return `<div class="side-item"><div><b>${s} 班</b><small>${s==='N'?'00:00–08:00':s==='D'?'08:00–16:00':'16:00–24:00'}</small></div><span class="status ${r.status}">${txt}</span></div>`}).join('')}

function renderAlerts(data){
  const alerts=[],required=['staff','住院','出院','轉入','轉出','病危','死亡'],start=new Date(alertFrom()+'T12:00:00Z'),end=new Date($('#dashboardDate').value+'T12:00:00Z');end.setUTCDate(end.getUTCDate()-1);
  for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)){
    const date=d.toISOString().slice(0,10);
    units.forEach(u=>shifts.forEach(shift=>{
      const recordKey=key(date,shift,u.id),r=data[recordKey];
      if(!r){alerts.push({date,shift,unit:u.id,type:'漏填',detail:'此班別沒有填報紀錄',level:'empty'});return}
      if(r.status==='empty')alerts.push({date,shift,unit:u.id,type:'漏填',detail:'此班別尚未填寫',level:'empty'});
      else if(r.status==='draft')alerts.push({date,shift,unit:u.id,type:'未送出',detail:'資料只有暫存，尚未正式送出',level:'draft'});
      const missing=required.filter(f=>r[f]===null||r[f]===undefined||r[f]==='');
      if(missing.length)alerts.push({date,shift,unit:u.id,type:'欄位缺值',detail:`缺少：${missing.map(x=>x==='staff'?'實際上班人力':x).join('、')}`,level:'draft'});
      if((r.over||0)>0)alerts.push({date,shift,unit:u.id,type:'超床',detail:`超過有效床數 ${r.over} 床`,level:'draft'});
    }));
  }
  const priority={漏填:0,未送出:1,欄位缺值:2,超床:3};alerts.sort((a,b)=>(priority[a.type]-priority[b.type])||b.date.localeCompare(a.date));
  $('#alertCount').textContent=`${alerts.length} 筆待處理`;
  $('#alertTable').innerHTML=alerts.length?alerts.slice(0,100).map(a=>`<tr><td>${a.date}</td><td>${a.shift}</td><td><b>${a.unit}</b></td><td><span class="status ${a.level}">${a.type}</span></td><td>${a.detail}</td><td>待確認</td></tr>`).join(''):'<tr><td colspan="6"><div class="empty-state">目前沒有異常或漏填紀錄</div></td></tr>';
}
function formatStaff(value){return String(Number((value||0).toFixed(3)))}
function formatNursePatientRatio(patientCount,staffCount){return staffCount>0?`1：${(patientCount/staffCount).toFixed(1).replace(/\.0$/,'')}`:'—'}
function renderDashboard(){
  const date=$('#dashboardDate').value,shift=$('#dashboardShift').value,data=store.get();let beds=0,patients=0,empty=0,over=0,staff=0,done=0;
  const daily={住院:0,出院:0,轉入:0,轉出:0,病危:0,死亡:0,staff:0,completed:0,closing:0};
  units.forEach(u=>shifts.forEach(s=>{const r=data[key(date,s,u.id)];if(!r)return;daily.住院+=admissionTotal(r,u.id);daily.出院+=r.出院||0;daily.轉入+=r.轉入||0;daily.轉出+=r.轉出||0;daily.病危+=r.病危||0;daily.死亡+=r.死亡||0;daily.staff+=r.staff||0;if(r.status==='submitted')daily.completed++;if(s==='E')daily.closing+=r.patients||0}));
  operationalUnits.forEach(u=>shifts.forEach(s=>{const r=data[operationalKey(date,s,u.id)];if(!r)return;daily.staff+=u.type==='nursingHome'?nursingHomeStaff(r):r.staff||0;if(r.status==='submitted')daily.completed++}));
  $('#dClosing').textContent=daily.closing;$('#dAdmissions').textContent=daily.住院;$('#dDischarges').textContent=daily.出院;$('#dTransfers').textContent=`${daily.轉入}／${daily.轉出}`;$('#dCriticalDeaths').textContent=`${daily.病危}／${daily.死亡}`;$('#dStaff').textContent=formatStaff(daily.staff);
  const dailyStatus=$('#dailyStatus'),allShiftRecords=allLoginUnits.length*shifts.length;dailyStatus.textContent=`${daily.completed}/${allShiftRecords} 班完成`;dailyStatus.className=`status ${daily.completed===allShiftRecords?'done':'draft'}`;
  $('#specialOpsTable').innerHTML=operationalUnits.map(u=>{
    const records=shifts.map(s=>data[operationalKey(date,s,u.id)]||{status:'empty'}),sum=f=>records.reduce((n,r)=>n+(r[f]||0),0),last=records[2];
    let summary='';
    if(u.type==='emergency')summary=`來診 ${sum('visits')}、住院 ${sum('admitted')}、E班留觀 ${last.observation||0}`;
    if(u.type==='delivery')summary=`來診 ${sum('visits')}、自然產 ${sum('naturalBirth')}、剖腹產 ${sum('cesarean')}`;
    if(u.type==='operatingRoom')summary=`IN ${sum('inCount')}、OUT ${sum('outCount')}`;
    if(u.type==='nursingHome'){
      const staffTotal=records.reduce((total,r)=>total+nursingHomeStaff(r),0),needsBreakdown=records.some(r=>(r.staff||0)>0&&!hasNursingHomeStaffSplit(r));
      const staffing=needsBreakdown?`三班上班人力 ${formatStaff(staffTotal)} 人次（護理師／護佐待補分類）`:`三班人力：護理師 ${formatStaff(sum('nurseStaff'))}、護佐 ${formatStaff(sum('aideStaff'))}、合計 ${formatStaff(staffTotal)} 人次`;
      summary=`住民 ${last.residents||0}、保留床 ${last.reserved||0}、空床 ${Math.max(u.beds-(last.residents||0)-(last.reserved||0),0)}；${staffing}`;
    }
    if(u.type==='dialysis')summary=`血液透析：門診 ${sum('hemodialysisOutpatient')}、住院 ${sum('hemodialysisInpatient')}、重症 ${sum('hemodialysisCritical')}；腹膜透析 ${sum('peritonealDialysis')}`;
    const state=r=>`<span class="status ${r.status||'empty'}">${r.status==='submitted'?'完成':r.status==='draft'?'暫存':'未填'}</span>`;
    return `<tr><td><b>${u.id}</b></td><td>${summary}</td><td>${state(records[0])}</td><td>${state(records[1])}</td><td>${state(records[2])}</td></tr>`;
  }).join('');
  const rows=units.map(u=>{const r=data[key(date,shift,u.id)]||emptyRecord(),p=r.patients||0,e=Math.max(u.beds-p,0),o=Math.max(p-u.beds,0),rate=u.beds?Math.round(p/u.beds*100):0;beds+=u.beds;patients+=p;empty+=e;over+=o;staff+=r.staff||0;if(r.status==='submitted')done++;return{u,r,p,e,o,rate}});
  $('#mBeds').textContent=beds;$('#mPatients').textContent=patients;$('#mEmpty').textContent=empty;$('#mOver').textContent=over;$('#mStaff').textContent=formatStaff(staff);$('#mRatio').textContent=formatNursePatientRatio(patients,staff);$('#mProgress').textContent=`${done}/${units.length}`;
  const hospitalBeds=units.reduce((n,u)=>n+u.beds,0),closingPatients=units.reduce((sum,u)=>sum+(data[key(date,'E',u.id)]?.patients||0),0),nhRecord=data[operationalKey(date,'E','護理之家')],nh={beds:operationalUnits.find(u=>u.id==='護理之家').beds,residents:nhRecord?.residents??null,reserved:nhRecord?.reserved??null};const nhEmpty=Math.max(nh.beds-nh.residents-(nh.reserved||0),0);$('#hospitalBeds').textContent=hospitalBeds;$('#closingPatients').textContent=closingPatients;$('#hospitalEmpty').textContent=Math.max(hospitalBeds-closingPatients,0);$('#nhBeds').textContent=nh.beds;$('#nhResidents').textContent=nh.residents??'—';$('#nhReserved').textContent=nh.reserved??'—';$('#nhEmpty').textContent=nhRecord?nhEmpty:'—';
  $('#unitTable').innerHTML=rows.map(x=>`<tr><td><b>${x.u.id}</b></td><td class="num">${x.u.beds}</td><td class="num">${x.p}</td><td class="num">${x.e}</td><td class="num">${x.o}</td><td><span class="rate ${x.rate>100?'over':''}"><i style="width:${Math.min(x.rate,100)}%"></i></span>${x.rate}%</td><td class="num">${formatStaff(x.r.staff)}</td><td class="num"><b>${formatNursePatientRatio(x.p,x.r.staff||0)}</b></td><td class="num">${x.r.病危||0}</td><td><span class="status ${x.r.status}">${x.r.status==='submitted'?'完成':x.r.status==='draft'?'暫存':'未填'}</span></td></tr>`).join('');
  $('#occupancyChart').innerHTML=rows.map(x=>`<div class="bar-col"><b>${x.rate}%</b><div class="bar ${x.rate>100?'over':''}" style="height:${Math.max(Math.min(x.rate,120)/120*150,3)}px"></div><span>${x.u.id}</span></div>`).join('');
  const pending=rows.filter(x=>x.r.status!=='submitted');$('#pendingList').innerHTML=pending.length?pending.slice(0,10).map(x=>`<div class="side-item"><div><b>${x.u.id}</b><small>${shift} 班資料</small></div><span class="status ${x.r.status}">${x.r.status==='draft'?'已暫存':'尚未填寫'}</span></div>`).join(''):'<div class="empty-state">所有單位皆已完成填報</div>';
  renderAlerts(data);
}
$('#exportBtn').onclick=()=>{
  const date=$('#dashboardDate').value,shift=$('#dashboardShift').value,data=store.get(),head=['日期','班別','單位','床數','住院人數','空床數','超床數','上班人力','護病比','病危','狀態','當班住院合計',...admissionExportFields.map(([,label])=>label)].join(',')+'\n';
  const body=units.map(u=>{const r=data[key(date,shift,u.id)]||emptyRecord(),p=r.patients||0,fields=admissionFieldsByUnit[u.id]||[];return[date,shift,u.id,u.beds,p,Math.max(u.beds-p,0),Math.max(p-u.beds,0),formatStaff(r.staff),formatNursePatientRatio(p,r.staff||0),r.病危||0,r.status,admissionTotal(r,u.id),...admissionExportFields.map(([field])=>fields.some(([name])=>name===field)?r[field]??'':'')].join(',')}).join('\n');
  const blob=new Blob(['\ufeff'+head+body],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`護理動態_${dataset}_${date}_${shift}.csv`;a.click();URL.revokeObjectURL(a.href);
};
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.add('hidden'),2300)}

return {
  getBase,
  render(member,mode){session=member;dataset=mode;if(!session)return;renderEntry();if(session.role!=='unit')renderDashboard();},
  clear(){
    session=null;
    ['#unitTable','#occupancyChart','#pendingList','#specialOpsTable','#alertTable','#eventFields','#specialFields','#shiftProgress'].forEach(id=>$(id).replaceChildren());
    $$('.metric .value').forEach(el=>el.textContent='—');
    ['#staff','#previous'].forEach(id=>$(id).value='');
  }
};
}

```

## 修改後：vite.config.js（完整）

```javascript
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (key.startsWith('sb_secret_')) throw new Error('前端只能使用公開 key');
  if (key.split('.').length === 3) {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (payload.role !== 'anon') throw new Error('前端 JWT key 必須是 anon 角色');
  }
  return {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(url),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(key)
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true }
  };
});

```

## 修改後：package.json（完整）

```json
{
  "name": "nrop-nursing-platform",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20.19"
  },
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "node --test",
    "db:prepare": "node scripts/prepare-sql.mjs",
    "db:check": "node scripts/check-supabase.mjs"
  },
  "dependencies": {
    "@supabase/supabase-js": "2.99.3"
  },
  "devDependencies": {
    "@electric-sql/pglite": "0.5.11",
    "dotenv": "17.3.1",
    "jsdom": "26.1.0",
    "vite": "7.3.7"
  }
}

```

## 修改後：.gitignore（完整）

```
.env
.env.*
env.local
!.env.example
node_modules/
dist/
coverage/
playwright-report/
test-results/
*.log
artifacts/private/

```

## 修改後：.dockerignore（完整）

```
.git
.env
.env.*
env.local
node_modules
dist
docs
tests
supabase
*.log

```

## 修改後：Dockerfile（完整）

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# 這兩個值是公開設定，可做 build arguments；不是資料庫密碼或 service_role。
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
COPY index.html vite.config.js ./
COPY src ./src
COPY assets ./assets
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

```

## 修改後：nginx.conf（完整）

```
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header X-Frame-Options DENY always;
    location / { try_files $uri $uri/ /index.html; }
    location /assets/ { try_files $uri =404; expires 7d; }
    location ~ /\. { deny all; }
}

```

## 新增資料庫檔案

原版沒有資料庫結構；新增完整檔案如下，均可直接開啟複製：

- [INSTALL.sql](../supabase/INSTALL.sql)：建表、權限、單位設定與 DEMO，安裝時完整貼上。
- [003_bootstrap_admin.sql](../supabase/003_bootstrap_admin.sql)：修改自己的 Email 後，初始化第一位管理者。
- [004_verify_install.sql](../supabase/004_verify_install.sql)：安裝後只讀核對。

[安裝指南](Supabase與帳號系統_安裝指南.md)；[驗證紀錄](驗證紀錄_2026-10-26.md)。
