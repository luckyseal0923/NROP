import { supabase, rpc, errorMessage, requireApprovalOnlySignup, confirmBedChange, initializeAuthRedirect } from './api.js';
import { units, operationalUnits, allLoginUnits } from './catalog.js';
import { RecordStore, dateOffset, escapeHtml as esc } from './record-store.js';
import { $, $$, today } from './dom.js';
import { createReporting } from './report-renderers.js';
import { createVersionChecker, createEditGuard } from './app-version.js';
import { createBedManagement } from './bed-management.js';

const roles={unit:'平台使用者',admin:'一般管理者',sysadmin:'系統管理者'};
const statuses={pending:'待審核',active:'啟用',disabled:'停用'};
let session=null, config=null, busy=false, loading=false, authEpoch=0, accountRows=[], passwordRecovery=false;
const store=new RecordStore(rpc,new Set(operationalUnits.map(u=>u.id)));
const reporting=createReporting({store,persistRecord,alertFrom});
const edits=createEditGuard(document);
const reportFields='#staff,#openingPatients,.event-input,.special-input';
const bedManagement=createBedManagement({getSession:()=>session,isEnabled:()=>!!config?.bedCapacityManagement,rpc,confirmChange:confirmBedChange,errorMessage,
 onBusy:()=>syncControls(),onRendered:()=>edits.capture('beds','#bedSettingsForm input,#bedSettingsForm select'),onSaved:async()=>{await loadConfig();await refreshData();}});
function renderReporting(){reporting.render(session);edits.capture('report',reportFields);}
function hasAuthEdits(){
 return ['#loginForm','#registerForm','#joinForm','#passwordForm','#bedConfirmForm'].some(selector=>{
  const form=$(selector),dialog=form.closest('dialog');
  return !form.closest('.hidden,[hidden]')&&(!dialog||dialog.open)&&[...form.querySelectorAll('input')].some(input=>input.value!=='');
 });
}
createVersionChecker({window,current:__NROP_RELEASE__,base:import.meta.env.BASE_URL,enabled:import.meta.env.PROD,
 hasUnsavedChanges:()=>edits.hasChanges()||hasAuthEdits(),
 isBusy:()=>busy||loading||bedManagement.isBusy()||$$('#loginForm [type="submit"],#registerForm [type="submit"],#joinForm [type="submit"],#passwordForm [type="submit"],[data-save-account],#registrationOpen').some(button=>button.disabled)
});
const feedback=(selector,message,error=false)=>{const el=$(selector);el.textContent=message;el.classList.toggle('hidden',!message);el.classList.toggle('error',error);};
function toast(message){feedback('#toast',message);clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').classList.add('hidden'),4500);}
function setDates(date){['#entryDate','#specialDate','#dashboardDate'].forEach(id=>$(id).value=date);}
function alertFrom(){
 const date=$('#dashboardDate').value;
 const start=[dateOffset(date,-30),config?.recordStartDate||date].sort().at(-1);
 return start>date?date:start;
}
function syncControls(){
 const disabled=busy||loading||bedManagement.isBusy();
 ['#saveDraft','#submitRecord','#saveSpecialDraft','#submitSpecialRecord','#setOpening',
 '#entryDate','#entryShift','#specialDate','#specialShift','#dashboardDate','#dashboardShift','#refreshData'].forEach(id=>$(id).disabled=disabled);
 $$('[data-unit-picker]').forEach(select=>select.disabled=disabled);
 $$(reportFields).forEach(input=>input.disabled=disabled);
 $('#logoutBtn').disabled=disabled;
}
function renderUnitControls(){
 if(!session)return;
 const canSwitch=session.role==='admin'||session.role==='sysadmin';
 for(const type of ['entry','special']){
  const container=$('#'+type+'UnitControl');container.replaceChildren();
  if(!canSwitch){const label=document.createElement('strong');label.textContent=session.unit;container.append(label);continue;}
  const select=document.createElement('select');select.id=type+'UnitSelect';select.dataset.unitPicker='';select.setAttribute('aria-labelledby',type+'UnitLabel');
  for(const unit of config.units){const option=document.createElement('option');option.value=unit.id;option.textContent=unit.id;select.append(option);}
  select.value=session.unit;select.disabled=busy||loading;select.onchange=()=>changeUnit(select.value);container.append(select);
 }
}
function changeUnit(unit){
 if(!session)return;
 if(busy||loading||!['admin','sysadmin'].includes(session.role)||!config.units.some(u=>u.id===unit)){renderUnitControls();return;}
 const shift=$(operationalUnits.some(u=>u.id===session.unit)?'#specialShift':'#entryShift').value;
 session.unit=unit;$('#entryShift').value=shift;$('#specialShift').value=shift;renderUnitControls();renderReporting();
}
async function loadConfig(){
 const loaded=await rpc('nrop_public_config');
 if(!loaded?.units?.length)throw new Error('資料庫尚無單位設定，請執行完整 INSTALL.sql。');
 if(loaded.dataArea!=='shared')throw new Error('資料庫尚未更新為單一資料區，請在 SQL Editor 執行 UPGRADE_005_007.sql 後重新整理。');
 config=loaded;
 store.capacitiesEnabled=!!config.bedCapacityManagement;
 for(const serverUnit of config.units){const local=allLoginUnits.find(u=>u.id===serverUnit.id);if(local)local.beds=serverUnit.beds;}
 const applicationUnits=config.applicationUnits||[{id:'護理部'},...config.units];
 ['#registerUnit','#joinUnit'].forEach(id=>$(id).innerHTML=applicationUnits.map(u=>`<option value="${esc(u.id)}">${esc(u.id)}</option>`).join(''));
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
  if(!await store.load(from,date))return false;
  renderReporting();
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
  await rpc('nrop_save_record',{p_dataset:'live',p_date:date,p_shift:shift,p_unit:session.unit,p_payload:payload,p_status:status,p_version:version});
  edits.capture('report',reportFields);
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
 if(['accounts','beds'].includes(view)&&session.role!=='sysadmin')return;
 if(view==='dashboard'&&session.role==='unit')return;
 ['entry','dashboard','accounts','beds'].forEach(name=>$('#'+name+'View').classList.toggle('hidden',view!==name));
 $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===view));
 $('#pageTitle').textContent={entry:'單位每日填報',dashboard:'全院當日動態',accounts:'帳號管理',beds:'有效病床數管理'}[view];
 $('#pageSubtitle').textContent=view==='beds'?'僅系統管理者可調整；生效日三班同用新床數，歷史日期保留原母數。':session.role==='unit'?`${session.unit} 單位資料僅供授權人員填寫`:'依權限管理全院填報資料；異常紀錄顯示所選日期之前最多 30 天';
 if(view==='accounts')void loadAccounts();
 if(view==='beds')void bedManagement.load();
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
 document.querySelector('[data-view="beds"]').classList.toggle('hidden',member.role!=='sysadmin');
 renderUnitControls();
 if(!sameUser)setDates(today());
 showView('entry');await refreshData();
}
function clearApp(){
 session=null;store.clear();accountRows=[];edits.reset();$('#accountTable').replaceChildren();$('#auditTable').replaceChildren();
 bedManagement.clear();
 $('#entryUnitControl').replaceChildren();$('#specialUnitControl').replaceChildren();
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
  if(member?.status==='active'){await openApp(member);return;}
  clearApp();$('#sessionArea').hidden=false;$('#userChip').textContent=data.session.user.email;
  $('#joinForm').classList.toggle('hidden',!!member||!config?.registrationOpen);
  $('#membershipNotice').textContent=member?`${member.name}：${statuses[member.status]}。${member.status==='pending'?'申請已送出，請等待系統管理者核准；核准前無法使用平台。':'如需重新啟用，請聯絡系統管理者。'}`
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
function validPassword(value){return value.length>=6&&/[A-Za-z]/.test(value)&&/[0-9]/.test(value);}
function validateApplicationUnit(unit){
 if(unit==='護理部'&&!config.applicationUnits?.some(u=>u.id===unit))throw new Error('護理部申請尚未啟用，請先在 SQL Editor 執行 005_application_units.sql，再重新整理網站。');
}
$('#loginForm').onsubmit=e=>{e.preventDefault();void authAction(e.currentTarget,async()=>{
 if(!config)await loadConfig();
 const {error}=await supabase.auth.signInWithPassword({email:$('#account').value.trim(),password:$('#password').value});
 if(error)throw error;$('#password').value='';await resolveMembership();
});};
$('#registerForm').onsubmit=e=>{e.preventDefault();void authAction(e.currentTarget,async()=>{
 if(!config)await loadConfig();if(!config.registrationOpen)throw new Error('目前未開放新帳號申請');
 const password=$('#registerPassword').value;if(!validPassword(password))throw new Error('密碼至少 6 碼，包含英文與數字');
 const name=$('#registerName').value.trim(),unit=$('#registerUnit').value;
 validateApplicationUnit(unit);
 await requireApprovalOnlySignup();
 const {data,error}=await supabase.auth.signUp({email:$('#registerEmail').value.trim(),password,options:{data:{display_name:name,requested_unit:unit},emailRedirectTo:location.origin}});
 if(error)throw error;$('#registerPassword').value='';
 if(data.session){await rpc('nrop_request_access',{p_name:name,p_unit:unit});await resolveMembership();}
 else feedback('#authMessage','申請流程尚未完成，請聯絡管理者確認註冊設定；若此 Email 已有帳號，請直接登入。',true);
});};
$('#joinForm').onsubmit=e=>{e.preventDefault();void authAction(e.currentTarget,async()=>{
 validateApplicationUnit($('#joinUnit').value);
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
function showPasswordDialog(){
 $('#passwordForm').reset();feedback('#passwordMessage','');
 if(!$('#passwordDialog').open)$('#passwordDialog').showModal();
}
$('#changePasswordBtn').onclick=showPasswordDialog;
function cancelPassword(){
 $('#passwordDialog').close();$('#passwordForm').reset();
 if(passwordRecovery)void logout();else void resolveMembership();
}
$('#cancelPassword').onclick=cancelPassword;
$('#passwordDialog').addEventListener('cancel',event=>{event.preventDefault();cancelPassword();});
$('#passwordForm').onsubmit=e=>{e.preventDefault();void(async()=>{
 const password=$('#newPassword').value;
 if(!validPassword(password)){feedback('#passwordMessage','密碼至少 6 碼，包含英文與數字',true);return;}
 if(password!==$('#confirmPassword').value){feedback('#passwordMessage','兩次密碼不同',true);return;}
 const button=e.currentTarget.querySelector('[type="submit"]');button.disabled=true;
 try{const {error}=await supabase.auth.updateUser({password});if(error)throw error;$('#passwordDialog').close();$('#passwordForm').reset();toast('密碼已更新，請重新登入');await logout();}
 catch(error){feedback('#passwordMessage',errorMessage(error),true);}finally{button.disabled=false;}
})();};

$$('.tab').forEach(t=>t.onclick=()=>showView(t.dataset.view));
['#entryDate','#specialDate','#dashboardDate'].forEach(id=>{
 $(id).value=today();$(id).max=today();$(id).onchange=async()=>{if(!$(id).reportValidity()||!$(id).value)return;setDates($(id).value);await refreshData();};
});
['#entryShift','#specialShift','#dashboardShift'].forEach(id=>$(id).onchange=()=>renderReporting());
$('#refreshData').onclick=async()=>{await refreshData();if(!$('#appError').textContent)showView(document.querySelector('.tab.active')?.dataset.view||'entry');};
$('#setOpening').onclick=async()=>{
 if(!$('#openingPatients').reportValidity()||busy||loading)return;
 busy=true;syncControls();
 try{await rpc('nrop_set_opening',{p_dataset:'live',p_unit:session.unit,p_date:$('#entryDate').value,p_shift:$('#entryShift').value,p_patients:Number($('#openingPatients').value)});await refreshData();toast('期初住院人數已儲存');}
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
  edits.capture('accounts','#accountTable select,#registrationOpen');
  $$('[data-save-account]').forEach(button=>button.onclick=async()=>{
   button.disabled=true;const i=Number(button.dataset.saveAccount),a=accountRows[i],row=button.closest('tr');
   try{
    const role=row.querySelector('[data-account="role"]').value,unit=row.querySelector('[data-account="unit"]').value||null,status=row.querySelector('[data-account="status"]').value;
    if(role==='unit'&&status==='active'&&!unit)throw new Error('啟用平台使用者時必須指定填報單位；護理部人員請核准適當的管理者角色。');
    await rpc('nrop_admin_update_account',{p_user:a.userId,p_role:role,p_status:status,p_unit:unit,p_version:a.version});
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
   if(event==='SIGNED_OUT'){authEpoch++;passwordRecovery=false;clearApp();}
   if(event==='PASSWORD_RECOVERY'){passwordRecovery=true;setTimeout(()=>{$('#accountDialog').close();showPasswordDialog();},0);}
   // 不在 Auth 的同步 callback 裡呼叫其他 Auth 方法，避免鎖死工作階段。
  });
  const redirect=await initializeAuthRedirect();
  if(redirect.recovery){passwordRecovery=true;$('#accountDialog').close();showPasswordDialog();}
  await loadConfig();await resolveMembership();
 }catch(error){feedback('#connectionStatus',errorMessage(error),true);}
}
void init();
