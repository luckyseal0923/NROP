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
  plugins:[{name:'fake-api',setup(build){build.onLoad({filter:/[\\/]src[\\/]api\.js$/},()=>({contents:
   'export const supabase=window.__api.supabase;export const rpc=window.__api.rpc;export const errorMessage=e=>e.message;export const requireApprovalOnlySignup=window.__api.requireApprovalOnlySignup;'}));}}]
 })).outputFiles[0].text;
 return bundled;
}
const wait=async(condition)=>{for(let i=0;i<100;i++){if(condition())return;await new Promise(r=>setTimeout(r,5));}throw new Error('UI 等候逾時');};
async function mount(role='unit',{updatedSchema=true,autoConfirm=true,sharedSchema=true,records=[]}={}){
 const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'https://nrop.example.invalid',runScripts:'outside-only'}),w=dom.window,$=s=>w.document.querySelector(s);
 const calls=[];let current=null;let offline=false;
 const member={userId:'member-1',name:'測試人員',email:'member@example.invalid',role,status:'active',unit:role==='unit'?'7A':null,version:1};
 const config={registrationOpen:true,dataArea:sharedSchema?'shared':undefined,recordStartDate:'2026-08-01',latestRecordDate:'2026-10-25',units:allLoginUnits.map(u=>({id:u.id,beds:u.beds,type:u.type}))};
 if(updatedSchema)config.applicationUnits=[{id:'護理部',reportUnit:null},...config.units.map(u=>({id:u.id,reportUnit:u.id}))];
 for(const dialog of w.document.querySelectorAll('dialog')){dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');}
 w.__api={requireApprovalOnlySignup:async()=>{if(!autoConfirm)throw new Error('請管理者將 ENABLE_EMAIL_AUTOCONFIRM 設為 true');},supabase:{auth:{onAuthStateChange(){},async getSession(){return{data:{session:current?{user:{email:member.email,user_metadata:{}}}:null}};},
 async signInWithPassword(credentials){if(credentials.password==='wrong')return{error:{message:'密碼錯誤'}};current=member;return{data:{session:{}}};},
 async signOut(){current=null;return{};},async signUp(params){calls.push({name:'auth.signUp',params});current={...member,status:'pending',name:params.options.data.display_name,requestedUnit:params.options.data.requested_unit,unit:null};return{data:{session:{}}};},async updateUser(params){calls.push({name:'auth.updateUser',params});return{};}}},rpc:async(name,params={})=>{
  calls.push({name,params});if(offline)throw new Error('offline');
  if(name==='nrop_public_config')return config;if(name==='nrop_current_account')return current;
  if(name==='nrop_request_access')return current;
  if(name==='nrop_list_records')return records;if(name==='nrop_list_openings')return[];
  if(name==='nrop_admin_accounts')return[{...member,name:'<img src=x onerror="alert(1)">',requestedUnit:'6A'}];
  if(name==='nrop_admin_audit')return[];if(name==='nrop_save_record')return{};
  throw new Error('未預期 RPC '+name);
 }};
 w.eval(await source());await wait(()=>$('#connectionStatus').textContent.includes(sharedSchema?'已連線':'單一資料區'));
 const login=async(password='correct')=>{$('#account').value=member.email;$('#password').value=password;$('#loginForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!$('#loginForm button[type="submit"]').disabled);};
 return{dom,w,$,calls,login,setOffline:value=>offline=value};
}
test('登入不可任意密碼，平台使用者無管理頁籤，資料存 Supabase RPC 並含版本',async()=>{
 const {dom,w,$,calls,login}=await mount();
 try{
  assert.equal($('#account').value,'');assert.equal($('#password').value,'');assert.equal($('#role'),null);
  await login('wrong');assert.ok($('#appView').classList.contains('hidden'));
  await login();await wait(()=>$('#syncStatus').textContent.includes('已從 Supabase'));
  assert.equal($('#userChip').textContent,'測試人員｜平台使用者｜7A');assert.ok($('[data-view="accounts"]').classList.contains('hidden'));
  $('#staff').value='1.234';$('#saveDraft').click();await wait(()=>calls.some(c=>c.name==='nrop_save_record'));
  const saved=calls.find(c=>c.name==='nrop_save_record').params;assert.equal(saved.p_unit,'7A');assert.equal(saved.p_payload.staff,1.234);assert.equal(saved.p_version,0);assert.equal(saved.p_dataset,'live');
  await wait(()=>!$('#saveDraft').disabled);
  assert.equal(w.localStorage.getItem('nursing-daily-records'),null);
 }finally{dom.window.close();}
});
test('一般管理者選護理之家與洗腎重症，合計與小數欄位維持原需求',async()=>{
 const {dom,w,$,login}=await mount('admin');
 try{
  await login();await wait(()=>$('#syncStatus').textContent.includes('已從 Supabase'));
  $('#managedUnit').value='護理之家';$('#managedUnit').dispatchEvent(new w.Event('change'));
  const nurse=$('[data-field="nurseStaff"]'),aide=$('[data-field="aideStaff"]'),total=$('[data-field="staff"]');
  nurse.value='0.1';aide.value='0.2';nurse.dispatchEvent(new w.Event('input'));
  assert.equal(total.value,'0.3');assert.equal(nurse.step,'0.001');assert.equal(total.readOnly,true);
  $('#managedUnit').value='洗腎室';$('#managedUnit').dispatchEvent(new w.Event('change'));
  assert.ok($('[data-field="hemodialysisCritical"]'));assert.ok($('[data-view="accounts"]').classList.contains('hidden'));
  assert.equal($('#nhResidents').textContent,'—');
 }finally{dom.window.close();}
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
  assert.ok($('#connectionStatus').textContent.includes('UPGRADE_005_007.sql'));
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
  assert.ok($('#joinUnit option[value="護理部"]'));assert.equal($('#managedUnit option[value="護理部"]'),null);
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
