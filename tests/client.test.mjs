import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {RecordStore,dateOffset,escapeHtml} from '../src/record-store.js';
import {allLoginUnits} from '../src/catalog.js';

test('快取不接受較舊請求覆蓋、讀取失敗清空、無 localStorage 依賴',async()=>{
 let resolveOld;
 const fake=async(name,{p_dataset,p_from})=>{assert.equal(p_dataset,'live');return name==='nrop_list_openings'?[]:p_from==='2026-10-23'?new Promise(resolve=>resolveOld=resolve):[{date:'2026-10-24',shift:'N',unit:'7A',record:{staff:2}}];};
 const store=new RecordStore(fake,new Set());const old=store.load('2026-10-23','2026-10-23');
 await store.load('2026-10-24','2026-10-24');resolveOld([]);assert.equal(await old,false);assert.equal(Object.keys(store.get()).length,1);
 store.rpc=()=>Promise.reject(new Error('offline'));await assert.rejects(store.load('2026-10-24','2026-10-24'));
 assert.deepEqual(store.get(),{});assert.equal(dateOffset('2026-10-01',-1),'2026-09-30');
 assert.equal(escapeHtml('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');
});

let bundled;
async function source(){
 if(!bundled)bundled=(await build({entryPoints:['src/main.js'],bundle:true,write:false,format:'iife',platform:'browser',
  define:{__NROP_RELEASE__:JSON.stringify({version:'1.1.0',displayVersion:'NROP-20261027-01',buildId:'a'.repeat(32),builtAt:'2026-10-27T01:00:00Z'}),'import.meta.env.PROD':'true','import.meta.env.BASE_URL':'"/"'},
  plugins:[{name:'fake-api',setup(build){build.onLoad({filter:/[\\/]src[\\/]api\.js$/},()=>({contents:
   'export const supabase=window.__api.supabase;export const rpc=window.__api.rpc;export const errorMessage=e=>e.message;export const requireApprovalOnlySignup=window.__api.requireApprovalOnlySignup;export const confirmBedChange=window.__api.confirmBedChange;export const initializeAuthRedirect=window.__api.initializeAuthRedirect;'}));}}]
 })).outputFiles[0].text;
 return bundled;
}
const wait=async(condition)=>{for(let i=0;i<100;i++){if(condition())return;await new Promise(r=>setTimeout(r,5));}throw new Error('UI 等候逾時');};
async function mount(role='unit',{updatedSchema=true,autoConfirm=true,sharedSchema=true,bedSchema=true,records=[],unit='7A',capacities=[],bedHistory=[],recovery=false,redirectError='',registrationOpen=true,configError=''}={}){
 const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'https://nrop.example.invalid',runScripts:'outside-only'}),w=dom.window,$=s=>w.document.querySelector(s);
 const calls=[];let current=null;let offline=false;let configFailure=configError;
 w.fetch=async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>({version:'1.1.0',buildId:'a'.repeat(32),builtAt:'2026-10-27T01:00:00Z'})});
 const member={userId:'member-1',name:'測試人員',email:'member@example.invalid',role,status:'active',unit:role==='unit'?unit:null,version:1};
 const config={registrationOpen,dataArea:sharedSchema?'shared':undefined,bedCapacityManagement:bedSchema,recordStartDate:'2026-08-01',latestRecordDate:'2026-10-25',units:allLoginUnits.map(u=>({id:u.id,beds:u.beds,type:u.type}))};
 const bedRows=[...allLoginUnits.map(u=>({unit:u.id,effectiveDate:'2000-01-01',beds:u.beds})),...capacities];let prepared;
 if(updatedSchema)config.applicationUnits=[{id:'護理部',reportUnit:null},...config.units.map(u=>({id:u.id,reportUnit:u.id}))];
 for(const dialog of w.document.querySelectorAll('dialog')){dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');}
 w.__api={requireApprovalOnlySignup:async()=>{if(!autoConfirm)throw new Error('請管理者將 ENABLE_EMAIL_AUTOCONFIRM 設為 true');},supabase:{auth:{onAuthStateChange(){},async getSession(){return{data:{session:current?{user:{email:member.email,user_metadata:{}}}:null}};},
 async signInWithPassword(credentials){if(credentials.password==='wrong')return{error:{message:'密碼錯誤'}};current=member;return{data:{session:{}}};},
 async signOut(){current=null;return{};},async signUp(params){calls.push({name:'auth.signUp',params});current={...member,status:'pending',name:params.options.data.display_name,requestedUnit:params.options.data.requested_unit,unit:null};return{data:{session:{}}};},async updateUser(params){calls.push({name:'auth.updateUser',params});return{};}}},rpc:async(name,params={})=>{
  calls.push({name,params});if(offline)throw new Error('offline');
  if(name==='nrop_public_config'){if(configFailure)throw new Error(configFailure);return config;}if(name==='nrop_current_account')return current;
  if(name==='nrop_request_access')return current;
  if(name==='nrop_list_records')return records;if(name==='nrop_list_openings')return[];
  if(name==='nrop_list_bed_capacities')return bedRows;
  if(name==='nrop_admin_bed_settings')return{today:'2026-10-27',units:config.units.map(u=>({...u,version:1,periods:bedRows.filter(b=>b.unit===u.id)})),history:bedHistory};
  if(name==='nrop_prepare_bed_change'){prepared=params;return{requestId:'bed-request',unit:params.p_unit,effectiveDate:params.p_date,oldBeds:bedRows.filter(b=>b.unit===params.p_unit&&b.effectiveDate<=params.p_date).at(-1).beds,newBeds:params.p_beds,reason:params.p_reason};}
  if(name==='nrop_admin_accounts')return[{...member,name:'<img src=x onerror="alert(1)">',requestedUnit:'6A'}];
  if(name==='nrop_admin_audit')return[];if(name==='nrop_save_record')return{};
  throw new Error('未預期 RPC '+name);
 }};
 w.__api.confirmBedChange=async params=>{calls.push({name:'bed.confirm',params});if(params.password==='wrong')throw new Error('Email 或密碼錯誤');bedRows.push({unit:prepared.p_unit,effectiveDate:prepared.p_date,beds:prepared.p_beds});return{};};
 w.__api.initializeAuthRedirect=async()=>{if(redirectError)throw new Error(redirectError);if(recovery)current=member;return{recovery};};
 w.__api.supabase.auth.resetPasswordForEmail=async(email,options)=>{calls.push({name:'auth.recover',params:{email,options}});return{};};
 w.eval(await source());await wait(()=>configError?$('#connectionError').textContent.includes(configError):sharedSchema?$('#connectionStatus').textContent==='連線可用':$('#connectionError').textContent.includes('單一資料區'));
 const login=async(password='correct')=>{$('#account').value=member.email;$('#password').value=password;$('#loginForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!$('#loginForm button[type="submit"]').disabled);};
 const selectUnit=unit=>{const select=$($('#standardEntryGrid').classList.contains('hidden')?'#specialUnitSelect':'#entryUnitSelect');assert.ok(select,'目前卡片必須有單位切換選單');select.value=unit;select.dispatchEvent(new w.Event('change'));};
 return{dom,w,$,calls,login,selectUnit,setOffline:value=>offline=value,setConfigFailure:value=>configFailure=value};
}

test('重設驗證成功直接開新密碼框，更新前不查帳號或載入填報',async()=>{
 const {dom,w,$,calls}=await mount('unit',{recovery:true});
 try{
  assert.equal($('#passwordDialog').open,true);assert.equal($('#accountDialog').open,false);
  assert.ok($('#appView').classList.contains('hidden'));
  assert.equal(calls.some(c=>c.name==='nrop_current_account'),false);
  $('#newPassword').value='Abc123';$('#confirmPassword').value='Abc124';
  $('#passwordForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.ok($('#passwordMessage').textContent.includes('兩次密碼不同'));assert.equal(calls.some(c=>c.name==='auth.updateUser'),false);
  $('#confirmPassword').value='Abc123';$('#passwordForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await wait(()=>!$('#passwordForm button[type="submit"]').disabled);
  assert.equal(calls.find(c=>c.name==='auth.updateUser').params.password,'Abc123');
  assert.equal($('#passwordDialog').open,false);assert.equal($('#newPassword').value,'');
  assert.ok(!$('#loginView').classList.contains('hidden'));assert.ok($('#toast').textContent.includes('請重新登入'));
 }finally{dom.window.close();}
});

test('取消或 Escape 離開重設會登出並清空輸入，不進入平台',async()=>{
 for(const method of ['button','escape']){
  const {dom,w,$,calls}=await mount('unit',{recovery:true});
  try{
   $('#newPassword').value='Abc123';$('#password').value='synthetic-before-logout';
   if(method==='button')$('#cancelPassword').click();else $('#passwordDialog').dispatchEvent(new w.Event('cancel',{cancelable:true}));
   await wait(()=>!$('#passwordDialog').open&&$('#password').value==='');
   assert.equal($('#newPassword').value,'');assert.equal(calls.some(c=>c.name==='nrop_current_account'||c.name==='auth.updateUser'),false);
   assert.ok(!$('#loginView').classList.contains('hidden'));
  }finally{dom.window.close();}
 }
});

test('缺少或失效的重設驗證顯示說明，忘記密碼仍可申請新信',async()=>{
 const {dom,$,calls}=await mount('unit',{redirectError:'找不到這次重設的驗證資料，請重新按「忘記密碼」。'});
 try{
  assert.equal($('#passwordDialog').open,false);assert.ok($('#authMessage').textContent.includes('驗證資料'));
  assert.equal($('#connectionStatus').textContent,'連線可用');
  $('#account').value='member@example.invalid';$('#forgotPassword').click();await wait(()=>!$('#forgotPassword').disabled);
  assert.equal(calls.find(c=>c.name==='auth.recover').params.options.redirectTo,'https://nrop.example.invalid');
  assert.ok($('#authMessage').textContent.includes('未收到時請聯絡護理部確認網路設定。'));
 }finally{dom.window.close();}
});

test('連線狀態與版本共用頁尾，登入成功後仍保留，登入卡片無正常連線橫幅',async()=>{
 const {dom,$,login}=await mount();
 try{
  assert.equal($('#connectionStatus').closest('footer'),$('#appVersion').closest('footer'));
  assert.equal($('#connectionStatus').closest('#loginView'),null);
  assert.equal($('#connectionStatus').textContent,'連線可用');assert.equal($('#connectionStatus').classList.contains('notice'),false);
  assert.ok($('#connectionError').classList.contains('hidden'));
  await login();await wait(()=>!$('#refreshData').disabled);
  assert.equal($('#connectionStatus').closest('.hidden,[hidden]'),null);
 }finally{dom.window.close();}
});

test('連線失敗在登入區提供錯誤，再次登入重試成功會清除錯誤並恢復頁尾狀態',async()=>{
 const {dom,$,login,setConfigFailure}=await mount('unit',{configError:'服務暫時無法連線，請稍後重試'});
 try{
  assert.equal($('#connectionStatus').textContent,'連線異常');assert.equal($('#connectionStatus').dataset.state,'error');
  assert.ok(!$('#connectionError').classList.contains('hidden'));assert.equal($('#connectionError').closest('#loginView').id,'loginView');
  setConfigFailure('');await login();await wait(()=>!$('#refreshData').disabled);
  assert.equal($('#connectionStatus').textContent,'連線可用');assert.ok($('#connectionError').classList.contains('hidden'));
 }finally{dom.window.close();}
});

test('暫停申請保留登入區提醒且不誤報為連線異常',async()=>{
 const {dom,$}=await mount('unit',{registrationOpen:false});
 try{
  assert.equal($('#connectionStatus').textContent,'連線可用');
  assert.equal($('#registrationNotice').textContent,'目前暫停新帳號申請');assert.ok(!$('#registrationNotice').classList.contains('hidden'));
  assert.equal($('[data-auth="register"]').disabled,true);
 }finally{dom.window.close();}
});
test('登入及填報頁共用版本入口，平台使用者更新前可保留未儲存內容',async()=>{
 const {dom,w,$,login}=await mount();let confirmations=0;
 try{
  await wait(()=>$('#versionStatus').textContent.includes('最新版本'));
  assert.equal($('#appVersion').textContent,'NROP-20261027-01');assert.equal($('#appVersion').closest('.hidden'),null);
  await login();await wait(()=>$('#syncStatus').textContent.includes('已從 Supabase'));
  w.fetch=async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>({version:'1.2.0',buildId:'b'.repeat(32),builtAt:'2026-10-27T02:00:00Z'})});
  $('#checkVersion').click();await wait(()=>!$('#updateNotice').classList.contains('hidden'));
  $('#staff').value='1.234';w.confirm=()=>{confirmations++;return false;};$('#reloadVersion').click();
  assert.equal(confirmations,1);assert.equal($('#staff').value,'1.234');
  assert.equal($('#appVersion').closest('.hidden'),null);
 }finally{dom.window.close();}
});
test('系統管理者可查看床數並再次輸入本人帳密，取消或驗證失敗不會儲存',async()=>{
 const {dom,w,$,calls,login}=await mount('sysadmin');
 try{
  await login();await wait(()=>!$('#refreshData').disabled);
  $('[data-view="beds"]').click();await wait(()=>w.document.querySelectorAll('.bed-unit-card').length===28);
  assert.equal($('#bedSettingsContent').closest('.hidden'),null);assert.ok($('#bedHospitalTotal').textContent.includes('626'));
  assert.equal($('#bedSettingsTable'),null);assert.equal($('#bedHistory'),null);assert.equal($('#bedEditDialog').open,false);
  assert.equal($('#bedSettingsForm').closest('dialog').id,'bedEditDialog');
  $('[data-edit-bed="7A"]').click();assert.equal($('#bedEditDialog').open,true);$('#newBeds').value='40';$('#bedEffectiveDate').value='2026-10-28';
  $('#bedSettingsForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>$('#bedConfirmDialog').open);
  assert.ok($('#bedConfirmSummary').textContent.includes('45 床 → 40 床'));assert.ok($('#bedConfirmSummary').textContent.includes('N／D／E'));
  assert.equal($('#bedConfirmAccount').value,'');assert.equal($('#bedConfirmPassword').value,'');
  $('#cancelBedConfirm').click();assert.equal($('#bedConfirmDialog').open,false);assert.equal($('#bedEditDialog').open,true);assert.equal($('#newBeds').value,'40');assert.equal(calls.filter(c=>c.name==='bed.confirm').length,0);
  $('#bedSettingsForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>$('#bedConfirmDialog').open);
  $('#bedReviewed').checked=true;$('#bedConfirmAccount').value='other@example.invalid';$('#bedConfirmPassword').value='correct';
  $('#bedConfirmForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(calls.filter(c=>c.name==='bed.confirm').length,0);assert.equal($('#bedConfirmPassword').value,'');
  $('#bedConfirmAccount').value='member@example.invalid';$('#bedConfirmPassword').value='wrong';
  $('#bedConfirmForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!$('#bedConfirmForm [type="submit"]').disabled);
  assert.equal($('#bedConfirmDialog').open,true);assert.ok($('#bedConfirmFeedback').textContent.includes('密碼錯誤'));assert.equal($('#bedConfirmPassword').value,'');
  $('#bedConfirmPassword').value='correct';$('#bedConfirmForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await wait(()=>$('#bedSettingsFeedback').textContent.includes('已儲存'));
  assert.equal($('#bedConfirmDialog').open,false);assert.equal($('#bedEditDialog').open,false);assert.equal($('#bedConfirmPassword').value,'');
  assert.equal(calls.filter(c=>c.name==='bed.confirm').length,2);
 }finally{dom.window.close();}
});

test('單位卡片開啟固定單位彈框，只顯示本單位紀錄與完整生效沿革，關閉後不殘留',async()=>{
 const history=[{unit:'7A',before:{beds:45},after:{beds:42,effectiveDate:'2026-10-20',reason:'測試調整 7A'},createdAt:'2026-10-19T09:00:00Z',actor:'管理者 A'},
 {unit:'7B',before:{beds:45},after:{beds:40,effectiveDate:'2026-10-21',reason:'僅屬於 7B'},createdAt:'2026-10-20T09:00:00Z',actor:'管理者 B'}];
 const capacities=[{unit:'7A',effectiveDate:'2026-10-20',beds:42},{unit:'7A',effectiveDate:'2026-10-30',beds:40}];
 const {dom,w,$,calls,login}=await mount('sysadmin',{bedHistory:history,capacities});
 try{
  await login();await wait(()=>!$('#refreshData').disabled);$('[data-view="beds"]').click();await wait(()=>w.document.querySelectorAll('.bed-unit-card').length===28);
  assert.equal(w.document.querySelectorAll('.bed-unit-group').length,3);assert.ok($('[data-bed-unit="7A"]').textContent.includes('2026-10-30 起 40 床'));
  $('[data-edit-bed="7A"]').click();assert.equal($('#bedEditTitle').textContent,'7A 床數調整');assert.equal($('#bedUnitName').textContent,'7A');assert.equal($('#bedUnit'),null);
  assert.match($('#bedUnitHistory').textContent,/45 床 → 42 床/);assert.match($('#bedUnitHistory').textContent,/管理者 A/);assert.doesNotMatch($('#bedUnitHistory').textContent,/管理者 B|僅屬於 7B/);
  assert.equal($('#bedUnitTimeline').children.length,3);assert.match($('#bedUnitTimeline').textContent,/原始床數基準|2026-10-30/);
  $('#newBeds').value='39';$('#bedReason').value='尚未送出';$('#cancelBedEdit').click();assert.equal($('#bedEditDialog').open,false);assert.equal(calls.filter(c=>c.name==='nrop_prepare_bed_change').length,0);
  $('[data-edit-bed="7B"]').click();assert.equal($('#bedReason').value,'');assert.equal($('#bedUnitName').textContent,'7B');assert.match($('#bedUnitHistory').textContent,/僅屬於 7B/);assert.doesNotMatch($('#bedUnitHistory').textContent,/測試調整 7A/);
  $('#bedEditDialog').dispatchEvent(new w.Event('cancel',{cancelable:true}));assert.equal($('#bedEditDialog').open,false);
  $('[data-edit-bed="7A"]').click();$('#newBeds').value='40';$('#logoutBtn').click();await wait(()=>$('#loginView').classList.contains('hidden')===false);
  assert.equal($('#bedEditDialog').open,false);assert.equal($('#bedUnitCards').children.length,0);assert.equal($('#bedUnitHistory').children.length,0);
  await new Promise(resolve=>w.setTimeout(resolve,0));
 }finally{dom.window.close();}
});

test('歷史文字安全轉義，近期紀錄不足時不把完整沿革誤當沒有歷史',async()=>{
 const history=Array.from({length:100},(_,i)=>({unit:'7B',before:{beds:45},after:{beds:40,effectiveDate:'2026-10-20',reason:'other'},createdAt:'2026-10-19T09:00:00Z',actor:'other'}));
 history[0]={unit:'7A',before:{beds:45},after:{beds:42,effectiveDate:'2026-10-20',reason:'<img src=x onerror="alert(1)">'},createdAt:'2026-10-19T09:00:00Z',actor:'<script>bad</script>'};
 const {dom,w,$,login}=await mount('sysadmin',{bedHistory:history,capacities:[{unit:'6A',effectiveDate:'2026-10-20',beds:30}]});
 try{
  await login();await wait(()=>!$('#refreshData').disabled);$('[data-view="beds"]').click();await wait(()=>w.document.querySelectorAll('.bed-unit-card').length===28);
  $('[data-edit-bed="7A"]').click();assert.equal($('#bedUnitHistory img'),null);assert.equal($('#bedUnitHistory script'),null);assert.match($('#bedUnitHistory').textContent,/<img/);assert.match($('#bedHistoryNote').textContent,/全院最近 100 筆/);
  $('#closeBedEdit').click();$('[data-edit-bed="6A"]').click();assert.match($('#bedUnitHistory').textContent,/近期載入/);assert.equal($('#bedUnitTimeline').children.length,2);assert.match($('#bedUnitTimeline').textContent,/30 床/);
 }finally{dom.window.close();}
});

test('一般使用者及一般管理者無床數管理頁籤，舊資料庫會明確提示升級',async()=>{
 for(const role of ['unit','admin']){
  const {dom,w,$,calls,login}=await mount(role);
  try{
   await login();await wait(()=>!$('#refreshData').disabled);assert.ok($('[data-view="beds"]').classList.contains('hidden'));
   $('[data-view="beds"]').click();assert.ok($('#bedsView').classList.contains('hidden'));assert.equal(calls.filter(c=>c.name==='nrop_admin_bed_settings').length,0);
  }finally{dom.window.close();}
 }
 const {dom,$,calls,login}=await mount('sysadmin',{bedSchema:false});
 try{
  await login();await wait(()=>!$('#refreshData').disabled);$('[data-view="beds"]').click();
  assert.ok($('#bedSettingsFeedback').textContent.includes('資料庫更新'));assert.ok($('#bedSettingsContent').classList.contains('hidden'));
  assert.equal(calls.filter(c=>c.name==='nrop_admin_bed_settings'||c.name==='nrop_list_bed_capacities').length,0);
 }finally{dom.window.close();}
});

test('生效日三班及儀表板共用日期母數，歷史日期仍顯示原床數，0 床不產生無限占床率',async()=>{
 const records=['N','D','E'].flatMap(shift=>[{date:'2026-10-24',shift,unit:'7A',record:{patients:10,status:'submitted',staff:2}},
 {date:'2026-10-25',shift,unit:'7A',record:{patients:10,status:'submitted',staff:2}}]);
 const capacities=[{unit:'7A',effectiveDate:'2026-10-25',beds:20},{unit:'7A',effectiveDate:'2026-10-26',beds:0}];
 const {dom,w,$,login,selectUnit}=await mount('sysadmin',{records,capacities});
 try{
  await login();await wait(()=>!$('#refreshData').disabled);selectUnit('7A');
  for(const [date,expected] of [['2026-10-24','45'],['2026-10-25','20'],['2026-10-26','0']]){
   $('#entryDate').value=date;$('#entryDate').dispatchEvent(new w.Event('change'));await wait(()=>!$('#refreshData').disabled);
   for(const shift of ['N','D','E']){$('#entryShift').value=shift;$('#entryShift').dispatchEvent(new w.Event('change'));assert.equal($('#bedCount').textContent,expected);}
   assert.equal($('#hospitalBeds').textContent,String(626-45+Number(expected)));
   assert.doesNotMatch($('#unitTable').textContent,/Infinity|NaN/);
  }
 }finally{dom.window.close();}
});

test('登入不可任意密碼，平台使用者無管理頁籤，資料存 Supabase RPC 並含版本',async()=>{
 const {dom,w,$,calls,login}=await mount();
 try{
  assert.equal($('#account').value,'');assert.equal($('#password').value,'');assert.equal($('#role'),null);
  await login('wrong');assert.ok($('#appView').classList.contains('hidden'));
  await login();await wait(()=>$('#syncStatus').textContent.includes('已從 Supabase'));
  assert.equal($('#userChip').textContent,'測試人員｜平台使用者｜7A');assert.ok($('[data-view="accounts"]').classList.contains('hidden'));
  assert.equal($('#calculationGuide').closest('.hidden'),null);assert.ok($('#calculationRules').textContent.includes('前班住院人數'));
  $('#staff').value='1.234';$('#saveDraft').click();await wait(()=>calls.some(c=>c.name==='nrop_save_record'));
  const saved=calls.find(c=>c.name==='nrop_save_record').params;assert.equal(saved.p_unit,'7A');assert.equal(saved.p_payload.staff,1.234);assert.equal(saved.p_version,0);assert.equal(saved.p_dataset,'live');
  await wait(()=>!$('#saveDraft').disabled);
  assert.equal(w.localStorage.getItem('nursing-daily-records'),null);
 }finally{dom.window.close();}
});

test('急診平台使用者可查看計算說明與所選日期的三班進度',async()=>{
 const records=[{date:'2026-10-25',shift:'N',unit:'急診',record:{status:'submitted',staff:2}},
  {date:'2026-10-25',shift:'D',unit:'急診',record:{status:'draft',staff:1}}];
 const {dom,w,$,login}=await mount('unit',{unit:'急診',records});
 try{
  await login();await wait(()=>$('#syncStatus').textContent.includes('已從 Supabase'));
  assert.equal($('#calculationGuide').closest('.hidden'),null);
  assert.ok($('#standardEntryGrid').classList.contains('hidden'));assert.ok(!$('#specialEntryView').classList.contains('hidden'));
  assert.ok($('#calculationRules').textContent.includes('E 班留觀人數'));
  assert.equal(w.document.querySelectorAll('#calculationGuide').length,1);
  $('#specialDate').value='2026-10-25';$('#specialDate').dispatchEvent(new w.Event('change'));
  await wait(()=>!$('#refreshData').disabled);
  assert.deepEqual([...w.document.querySelectorAll('#shiftProgress .status')].map(el=>el.textContent),['已完成','已暫存','待填報']);
  $('#specialDate').value='2026-10-24';$('#specialDate').dispatchEvent(new w.Event('change'));
  await wait(()=>!$('#refreshData').disabled);
  assert.deepEqual([...w.document.querySelectorAll('#shiftProgress .status')].map(el=>el.textContent),['待填報','待填報','待填報']);
  assert.ok($('[data-view="dashboard"]').classList.contains('hidden'));assert.ok($('[data-view="accounts"]').classList.contains('hidden'));
 }finally{dom.window.close();}
});

test('各特殊單位的平台使用者都有對應說明與三班進度',async()=>{
 const cases=[['產房','全日來診、自然產及剖腹產'],['手術室','全日 IN'],['護理之家','上班人力 ＝ 護理師 ＋ 護佐'],['洗腎室','門診、住院、重症三欄']];
 for(const [unit,expected] of cases){
  const {dom,w,$,login}=await mount('unit',{unit});
  try{
   await login();await wait(()=>$('#syncStatus').textContent.includes('已從 Supabase'));
   assert.equal($('#calculationGuide').closest('.hidden'),null);assert.ok($('#calculationRules').textContent.includes(expected));
   assert.equal(w.document.querySelectorAll('#shiftProgress .side-item').length,3);
   assert.equal($('[data-unit-picker]'),null);assert.equal($('#specialUnitControl').textContent,unit);
  }finally{dom.window.close();}
 }
});

test('管理者切換病房及特殊單位時，共用說明與進度不殘留前單位內容',async()=>{
 const {dom,w,$,login,selectUnit}=await mount('admin');
 try{
  await login();await wait(()=>$('#syncStatus').textContent.includes('已從 Supabase'));
  selectUnit('6A');assert.ok($('#calculationRules').textContent.includes('住院（本科） ＋ 住院（非本科）'));
  selectUnit('ICU-3');assert.ok($('#calculationRules').textContent.includes('住院（一般病房） ＋ 住院（負壓隔離）'));
  selectUnit('急診');assert.ok($('#calculationRules').textContent.includes('E 班留觀人數'));assert.ok(!$('#calculationRules').textContent.includes('住院（本科）'));
  selectUnit('護理之家');assert.ok($('#calculationRules').textContent.includes('上班人力 ＝ 護理師 ＋ 護佐'));
  selectUnit('7A');assert.ok($('#calculationRules').textContent.includes('前班住院人數'));assert.ok(!$('#calculationRules').textContent.includes('護佐'));
  assert.equal(w.document.querySelectorAll('#shiftProgress').length,1);
 }finally{dom.window.close();}
});
test('一般管理者選護理之家與洗腎重症，合計與小數欄位維持原需求',async()=>{
 const {dom,w,$,login,selectUnit}=await mount('admin');
 try{
  await login();await wait(()=>$('#syncStatus').textContent.includes('已從 Supabase'));
  selectUnit('護理之家');
  const nurse=$('[data-field="nurseStaff"]'),aide=$('[data-field="aideStaff"]'),total=$('[data-field="staff"]');
  nurse.value='0.1';aide.value='0.2';nurse.dispatchEvent(new w.Event('input'));
  assert.equal(total.value,'0.3');assert.equal(nurse.step,'0.001');assert.equal(total.readOnly,true);
  selectUnit('洗腎室');
  assert.ok($('[data-field="hemodialysisCritical"]'));assert.ok($('[data-view="accounts"]').classList.contains('hidden'));
  assert.equal($('#nhResidents').textContent,'—');
 }finally{dom.window.close();}
});

test('兩種管理者都從動態卡片切換單位，保留日期班別並更新正確的儲存單位',async()=>{
 for(const role of ['admin','sysadmin']){
  const {dom,w,$,calls,login,selectUnit}=await mount(role);
  try{
   await login();await wait(()=>$('#syncStatus').textContent.includes('已從 Supabase'));
   assert.equal($('.platform-tools select'),null);assert.equal($('#managedUnit'),null);
   assert.ok($('#entryUnitControl').contains($('#entryUnitSelect')));
   assert.equal($('#entryUnitSelect').options.length,allLoginUnits.length);
   $('#entryDate').value='2026-10-25';$('#entryDate').dispatchEvent(new w.Event('change'));await wait(()=>!$('#refreshData').disabled);
   $('#entryShift').value='D';$('#entryShift').dispatchEvent(new w.Event('change'));
   selectUnit('急診');
   assert.equal($('#specialUnitSelect').value,'急診');assert.equal($('#entryUnitSelect').value,'急診');
   assert.equal($('#specialDate').value,'2026-10-25');assert.equal($('#specialShift').value,'D');
   assert.equal($('#specialFormTitle').textContent,'急診每日動態填報');assert.equal($('#specialBeds').textContent,'33 床');
   $('#saveSpecialDraft').click();await wait(()=>calls.some(c=>c.name==='nrop_save_record'));await wait(()=>!$('#saveSpecialDraft').disabled);
   const saved=calls.find(c=>c.name==='nrop_save_record').params;
   assert.equal(saved.p_unit,'急診');assert.equal(saved.p_date,'2026-10-25');assert.equal(saved.p_shift,'D');
   selectUnit('8A');assert.equal($('#entryUnitSelect').value,'8A');assert.equal($('#bedCount').textContent,'32');assert.equal($('#entryShift').value,'D');
   selectUnit('不存在的單位');assert.equal($('#entryUnitSelect').value,'8A');
  }finally{dom.window.close();}
 }
});

test('平台使用者的卡片僅顯示核准單位名稱，沒有其他單位選項且儲存仍使用核准單位',async()=>{
 for(const unit of ['7A','急診']){
  const {dom,w,$,calls,login}=await mount('unit',{unit});
  try{
   await login();await wait(()=>$('#syncStatus').textContent.includes('已從 Supabase'));
   assert.equal($('.platform-tools select'),null);assert.equal($('[data-unit-picker]'),null);
   assert.equal($('#entryUnitControl').textContent,unit);assert.equal($('#specialUnitControl').textContent,unit);
   assert.equal($('#entryUnitControl select'),null);assert.equal($('#specialUnitControl select'),null);
   // 修改可見文字不能改變已核准的填報目標。
   $(unit==='急診'?'#specialUnitControl':'#entryUnitControl').textContent='其他單位';
   $(unit==='急診'?'#saveSpecialDraft':'#saveDraft').click();
   await wait(()=>calls.some(c=>c.name==='nrop_save_record'));
   assert.equal(calls.find(c=>c.name==='nrop_save_record').params.p_unit,unit);
   await wait(()=>!$(unit==='急診'?'#saveSpecialDraft':'#saveDraft').disabled);
  }finally{dom.window.close();}
 }
});
test('系統管理者帳號頁安全轉義姓名；僅有一個資料區；讀取失敗遮蔽表格',async()=>{
 const {dom,w,$,calls,login,setOffline}=await mount('sysadmin');
 try{
  await login();await wait(()=>$('#syncStatus').textContent.includes('已從 Supabase'));
  $('[data-view="accounts"]').click();await wait(()=>$('#accountTable').children.length>0);
  assert.equal($('#accountTable img'),null);assert.ok($('#accountTable').textContent.includes('<img'));
  assert.equal($('#datasetSelect'),null);assert.equal($('#datasetNotice'),null);
  assert.doesNotMatch(w.document.body.textContent,/DEMO|正式與.*分區/);
  $('#dashboardDate').value='2026-10-25';$('#dashboardDate').dispatchEvent(new w.Event('change'));
  await wait(()=>calls.some(c=>c.name==='nrop_list_records'&&c.params.p_to==='2026-10-25'));
  await wait(()=>!$('#refreshData').disabled);
  assert.ok(calls.filter(c=>c.name==='nrop_list_records').every(c=>c.params.p_dataset==='live'));
  $('[data-view="entry"]').click();setOffline(true);$('#refreshData').click();
  await wait(()=>$('#syncStatus').textContent.includes('讀取失敗'));
  assert.ok($('#entryView').classList.contains('hidden'));assert.ok($('#dashboardView').classList.contains('hidden'));
 }finally{dom.window.close();}
});

test('尚未整併的資料庫阻擋登入，提示更新 SQL 而不顯示空白填報',async()=>{
 const {dom,$,calls,login}=await mount('unit',{sharedSchema:false});
 try{
  assert.ok($('#connectionError').textContent.includes('UPGRADE_005_007.sql'));
  await login();assert.ok($('#authMessage').textContent.includes('UPGRADE_005_007.sql'));
  assert.equal(calls.filter(c=>c.name==='nrop_list_records').length,0);
  assert.ok($('#appView').classList.contains('hidden'));
 }finally{dom.window.close();}
});

test('歷史範例直接顯示、可修改，首班使用原有基準',async()=>{
 const records=[{date:'2026-08-01',shift:'N',unit:'7A',record:{staff:2.123,opening:20,patients:21,住院:1,出院:0,轉入:0,轉出:0,病危:0,死亡:0,status:'submitted',version:1,baselineReady:true}}];
 const {dom,w,$,calls,login}=await mount('unit',{records});
 try{
  await login();await wait(()=>$('#syncStatus').textContent.includes('已從 Supabase'));
  $('#entryDate').value='2026-08-01';$('#entryShift').value='N';$('#entryDate').dispatchEvent(new w.Event('change'));
  await wait(()=>!$('#refreshData').disabled);
  assert.equal($('#staff').value,'2.123');assert.equal($('#previous').value,'20');
  assert.ok($('#previousNotice').classList.contains('hidden'));
  $('#staff').value='3.123';$('#submitRecord').click();await wait(()=>calls.some(c=>c.name==='nrop_save_record'));
  const saved=calls.find(c=>c.name==='nrop_save_record').params;
  assert.equal(saved.p_dataset,'live');assert.equal(saved.p_version,1);assert.equal(saved.p_payload.staff,3.123);
  await wait(()=>!$('#submitRecord').disabled);
 }finally{dom.window.close();}
});
test('護理部可申請，六碼英數可註冊與變更密碼，短碼及單一字元類別被拒絕',async()=>{
 const {dom,w,$,calls,login}=await mount();
 try{
  assert.equal($('#registerUnit option[value="護理部"]').textContent,'護理部');
  assert.ok($('#joinUnit option[value="護理部"]'));assert.equal($('[data-unit-picker] option[value="護理部"]'),null);
  assert.equal($('#registerPassword').minLength,6);assert.equal($('#newPassword').minLength,6);assert.equal($('#confirmPassword').minLength,6);
  $('[data-auth="register"]').click();$('#registerName').value='護理部測試';$('#registerEmail').value='department@example.invalid';$('#registerUnit').value='護理部';
  for(const invalid of ['Ab123','abcdef','123456']){
   $('#registerPassword').value=invalid;$('#registerForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
   await wait(()=>!$('#registerForm button').disabled);assert.equal(calls.filter(c=>c.name==='auth.signUp').length,0);
  }
  $('#registerPassword').value='Abc123';$('#registerForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await wait(()=>!$('#registerForm button').disabled);
  const created=calls.find(c=>c.name==='auth.signUp');assert.equal(created.params.password,'Abc123');assert.equal(created.params.options.data.requested_unit,'護理部');
  assert.ok($('#membershipNotice').textContent.includes('請等待系統管理者核准'));assert.ok($('#appView').classList.contains('hidden'));
  $('[data-auth="login"]').click();await login();await wait(()=>$('#syncStatus').textContent.includes('已從 Supabase'));
  $('#changePasswordBtn').click();$('#newPassword').value=$('#confirmPassword').value='Abc123';
  $('#passwordForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await wait(()=>calls.some(c=>c.name==='auth.updateUser'));await wait(()=>!$('#loginView').classList.contains('hidden'));
 }finally{dom.window.close();}
});
test('舊資料庫仍顯示護理部，但在更新 SQL 前會阻擋申請並說明原因',async()=>{
 const {dom,w,$,calls}=await mount('unit',{updatedSchema:false});
 try{
  $('[data-auth="register"]').click();$('#registerName').value='護理部測試';$('#registerEmail').value='department@example.invalid';$('#registerUnit').value='護理部';$('#registerPassword').value='Abc123';
  $('#registerForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!$('#registerForm button').disabled);
  assert.equal(calls.filter(c=>c.name==='auth.signUp').length,0);assert.ok($('#authMessage').textContent.includes('005_application_units.sql'));
 }finally{dom.window.close();}
});
test('Auth 尚未關閉驗證信時，不呼叫 signUp，避免寄出驗證信',async()=>{
 const {dom,w,$,calls}=await mount('unit',{autoConfirm:false});
 try{
  $('[data-auth="register"]').click();$('#registerName').value='測試';$('#registerEmail').value='member@example.invalid';$('#registerUnit').value='7A';$('#registerPassword').value='Abc123';
  $('#registerForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!$('#registerForm button').disabled);
  assert.equal(calls.filter(c=>c.name==='auth.signUp').length,0);assert.ok($('#authMessage').textContent.includes('ENABLE_EMAIL_AUTOCONFIRM'));
 }finally{dom.window.close();}
});
