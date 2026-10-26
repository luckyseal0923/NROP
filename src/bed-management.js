import { $, $$ } from './dom.js';
import { escapeHtml as esc } from './record-store.js';

const typeLabels={ward:'一般病房',special:'特殊住院單位',emergency:'急診（參考）',delivery:'產房（參考）',operatingRoom:'手術室（參考）',nursingHome:'護理之家（獨立）',dialysis:'洗腎室（參考）'};
export function createBedManagement({getSession,isEnabled,rpc,confirmChange,errorMessage,onSaved,onBusy=()=>{},onRendered=()=>{}}){
 let settings=null,pending=null,busy=false,generation=0;
 const message=(selector,text,error=false)=>{const el=$(selector);el.textContent=text;el.classList.toggle('hidden',!text);el.classList.toggle('error',error);};
 function setBusy(value){busy=value;$$('#bedSettingsForm input,#bedSettingsForm select,#bedSettingsForm button,#bedConfirmForm input,#bedConfirmForm button,#reloadBedSettings,[data-edit-bed]').forEach(el=>el.disabled=value);onBusy();}
 function bedsAt(unit,date){return unit.periods.filter(p=>p.effectiveDate<=date).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate))[0]?.beds;}
 function renderPreview(){
  const unit=settings?.units.find(u=>u.id===$('#bedUnit').value),date=$('#bedEffectiveDate').value;
  $('#bedOriginal').textContent=unit&&date?`${bedsAt(unit,date)} 床`:'—';
 }
 function selectUnit(unit){$('#bedUnit').value=unit;renderPreview();$('#newBeds').value=bedsAt(settings.units.find(u=>u.id===unit),$('#bedEffectiveDate').value);}
 async function load(){
  if(getSession()?.role!=='sysadmin'||busy)return;
  const current=++generation;message('#bedSettingsFeedback','');$('#bedSettingsContent').classList.add('hidden');
  if(!isEnabled()){message('#bedSettingsFeedback','床數管理尚未啟用，請聯絡系統維護人員完成資料庫更新。',true);return;}
  setBusy(true);
  try{
   const data=await rpc('nrop_admin_bed_settings');
   if(current!==generation||getSession()?.role!=='sysadmin')return;
   settings=data;$('#bedSettingsForm').reset();$('#bedEffectiveDate').min=data.today;$('#bedEffectiveDate').value=data.today;
   $('#bedUnit').innerHTML=data.units.map(u=>`<option value="${esc(u.id)}">${esc(u.id)}</option>`).join('');
   $('#bedHospitalTotal').textContent=data.units.filter(u=>['ward','special'].includes(u.type)).reduce((total,u)=>total+u.beds,0)+' 床';
   $('#bedSettingsTable').innerHTML=data.units.map(u=>`<tr><td><b>${esc(u.id)}</b></td><td>${typeLabels[u.type]}</td><td class="num">${u.beds}</td><td>${u.periods.filter(p=>p.effectiveDate>data.today).map(p=>`${esc(p.effectiveDate)} 起 ${p.beds} 床`).join('<br>')||'—'}</td><td><button type="button" class="btn btn-soft" data-edit-bed="${esc(u.id)}">調整</button></td></tr>`).join('');
   $('#bedHistory').innerHTML=data.history.length?data.history.map(row=>`<tr><td>${esc(new Date(row.createdAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}))}</td><td>${esc(row.unit)}</td><td>${esc(row.after.effectiveDate)}</td><td>${row.before.beds} → ${row.after.beds}</td><td>${esc(row.actor)}</td><td>${esc(row.after.reason||'—')}</td></tr>`).join(''):'<tr><td colspan="6">尚無床數調整紀錄</td></tr>';
   $$('[data-edit-bed]').forEach(button=>button.onclick=()=>{selectUnit(button.dataset.editBed);$('#bedSettingsForm').scrollIntoView?.({block:'start',behavior:'smooth'});$('#newBeds').focus({preventScroll:true});});
   selectUnit(data.units[0].id);$('#bedSettingsContent').classList.remove('hidden');onRendered();
  }catch(error){if(current===generation)message('#bedSettingsFeedback',errorMessage(error),true);}
  finally{setBusy(false);}
 }
 $('#bedUnit').onchange=()=>selectUnit($('#bedUnit').value);
 $('#bedEffectiveDate').onchange=()=>renderPreview();
 $('#reloadBedSettings').onclick=()=>void load();
 $('#bedSettingsForm').onsubmit=e=>{e.preventDefault();void(async()=>{
  if(busy||getSession()?.role!=='sysadmin'||!$('#bedSettingsForm').reportValidity())return;
  const unit=settings?.units.find(u=>u.id===$('#bedUnit').value);if(!unit)return;
  setBusy(true);message('#bedSettingsFeedback','');
  try{
   pending=await rpc('nrop_prepare_bed_change',{p_unit:unit.id,p_date:$('#bedEffectiveDate').value,p_beds:Number($('#newBeds').value),p_version:unit.version,p_reason:$('#bedReason').value.trim()});
   if(getSession()?.role!=='sysadmin'){pending=null;return;}
   $('#bedConfirmForm').reset();message('#bedConfirmFeedback','');
   $('#bedConfirmSummary').textContent=`${pending.unit}：${pending.oldBeds} 床 → ${pending.newBeds} 床\n生效日期：${pending.effectiveDate}（N／D／E 三班）\n${pending.effectiveDate} 之前的母數維持不變。${pending.reason?'\n調整原因：'+pending.reason:''}`;
   pending.userId=getSession().userId;pending.email=getSession().email;
   $('#bedConfirmDialog').showModal();
  }catch(error){message('#bedSettingsFeedback',errorMessage(error),true);}
  finally{setBusy(false);}
 })();};
 function cancel(){if(busy)return;pending=null;$('#bedConfirmForm').reset();$('#bedConfirmDialog').close();}
 $('#cancelBedConfirm').onclick=cancel;
 $('#bedConfirmDialog').addEventListener('cancel',e=>{e.preventDefault();cancel();});
 $('#bedConfirmForm').onsubmit=e=>{e.preventDefault();void(async()=>{
  if(busy||!pending||getSession()?.userId!==pending.userId||getSession()?.role!=='sysadmin'||!$('#bedConfirmForm').reportValidity())return;
  const email=$('#bedConfirmAccount').value.trim(),password=$('#bedConfirmPassword').value;
  $('#bedConfirmPassword').value='';
  if(email.toLowerCase()!==pending.email.toLowerCase()){message('#bedConfirmFeedback','請重新輸入目前登入系統管理者本人的帳號與密碼。',true);return;}
  setBusy(true);message('#bedConfirmFeedback','');
  try{
   await confirmChange({requestId:pending.requestId,email,password,expectedUserId:pending.userId});
   pending=null;$('#bedConfirmForm').reset();$('#bedConfirmDialog').close();
   await onSaved();
   setBusy(false);await load();message('#bedSettingsFeedback','床數設定已儲存，修改時間與操作者已記錄；生效當天三班套用，之前日期保留原母數。');
  }catch(error){message('#bedConfirmFeedback',errorMessage(error)+' 若無法確認結果，請先重新整理床數設定再重試。',true);}
  finally{setBusy(false);}
 })();};
 return {load,isBusy:()=>busy,clear(){generation++;pending=null;settings=null;$('#bedConfirmForm').reset();$('#bedSettingsForm').reset();$('#bedConfirmDialog').close();$('#bedSettingsTable').replaceChildren();$('#bedHistory').replaceChildren();$('#bedSettingsContent').classList.add('hidden');}};
}
