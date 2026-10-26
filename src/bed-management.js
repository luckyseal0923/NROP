import { $, $$ } from './dom.js';
import { escapeHtml as esc } from './record-store.js';

const typeLabels={ward:'一般病房',special:'特殊住院單位',emergency:'急診（參考）',delivery:'產房（參考）',operatingRoom:'手術室（參考）',nursingHome:'護理之家（獨立）',dialysis:'洗腎室（參考）'};
export function createBedManagement({getSession,isEnabled,rpc,confirmChange,errorMessage,onSaved,onBusy=()=>{},onRendered=()=>{}}){
 let settings=null,pending=null,editingUnit=null,busy=false,generation=0;
 const message=(selector,text,error=false)=>{const el=$(selector);el.textContent=text;el.classList.toggle('hidden',!text);el.classList.toggle('error',error);};
 function setBusy(value){busy=value;$$('#bedSettingsForm input,#bedSettingsForm button,#bedConfirmForm input,#bedConfirmForm button,#closeBedEdit,#reloadBedSettings,[data-edit-bed]').forEach(el=>el.disabled=value);onBusy();}
 function bedsAt(unit,date){return unit.periods.filter(p=>p.effectiveDate<=date).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate))[0]?.beds;}
 function renderPreview(){
  const unit=settings?.units.find(u=>u.id===editingUnit),date=$('#bedEffectiveDate').value;
  $('#bedOriginal').textContent=unit&&date?`${bedsAt(unit,date)} 床`:'—';
 }
 const time=value=>value?new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'—';
 function renderCards(){
  const groups=[['一般病房',['ward']],['特殊住院單位',['special']],['其他單位',['emergency','delivery','operatingRoom','nursingHome','dialysis']]];
  $('#bedUnitCards').innerHTML=groups.map(([name,types])=>{
   const units=settings.units.filter(unit=>types.includes(unit.type));
   return `<section class="bed-unit-group"><h3>${name}<small>${units.length} 單位</small></h3><div class="bed-unit-grid">${units.map(unit=>{
    const upcoming=unit.periods.filter(period=>period.effectiveDate>settings.today).sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate));
    return `<article class="bed-unit-card" data-bed-unit="${esc(unit.id)}" aria-label="${esc(unit.id)} 床數"><h4>${esc(unit.id)}</h4><small>${typeLabels[unit.type]}</small><div class="bed-unit-count"><strong>${esc(unit.beds)}</strong><span>床</span></div><small>${['ward','special'].includes(unit.type)?'目前有效病床數':'目前床數'}</small><p class="bed-upcoming">${upcoming.length?`${esc(upcoming[0].effectiveDate)} 起 ${esc(upcoming[0].beds)} 床${upcoming.length>1?`<br>另有 ${upcoming.length-1} 筆排定設定`:''}`:'尚未排定調整'}</p><button type="button" class="btn btn-soft" data-edit-bed="${esc(unit.id)}" aria-label="${esc(unit.id)} 調整床數">調整</button></article>`;
   }).join('')}</div></section>`;
  }).join('');
  $$('[data-edit-bed]').forEach(button=>button.onclick=()=>openEditor(button.dataset.editBed));
 }
 function renderHistory(unit){
  const history=settings.history.filter(row=>row.unit===unit.id);
  $('#bedHistoryNote').textContent=settings.history.length>=100?'從全院最近 100 筆調整紀錄篩選本單位；較早的生效設定可查看下方沿革。':`共 ${history.length} 筆本單位調整紀錄，修改時間以臺灣時區顯示。`;
  $('#bedUnitHistory').innerHTML=history.length?history.map(row=>`<article class="bed-history-item"><strong>${esc(row.before.beds)} 床 → ${esc(row.after.beds)} 床</strong><p>生效日期：${esc(row.after.effectiveDate)}<br>修改時間：${esc(time(row.createdAt))}<br>操作者：${esc(row.actor)}<br>原因：${esc(row.after.reason||'未填寫')}</p></article>`).join(''):`<p class="bed-history-empty">${settings.history.length>=100?'近期載入的紀錄中沒有本單位調整，既有生效設定請見下方沿革。':'本單位尚無調整紀錄。'}</p>`;
  $('#bedUnitTimeline').innerHTML=[...unit.periods].sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate)).map(period=>`<article class="bed-history-item"><strong>${esc(period.beds)} 床</strong><p>${period.effectiveDate==='2000-01-01'?'原始床數基準':`${esc(period.effectiveDate)} 起生效${period.effectiveDate>settings.today?'（已排定）':''}`}${period.updatedAt?`<br>設定時間：${esc(time(period.updatedAt))}`:''}</p></article>`).join('');
 }
 function openEditor(id){
  if(busy||getSession()?.role!=='sysadmin')return;
  const unit=settings?.units.find(row=>row.id===id);if(!unit)return;
  editingUnit=id;pending=null;$('#bedSettingsForm').reset();message('#bedEditFeedback','');
  $('#bedEditTitle').textContent=id+' 床數調整';$('#bedEditType').textContent=typeLabels[unit.type];$('#bedUnitName').textContent=id;$('#bedEditCurrent').textContent=unit.beds+' 床';
  $('#bedEffectiveDate').min=settings.today;$('#bedEffectiveDate').value=settings.today;$('#newBeds').value=bedsAt(unit,settings.today);renderPreview();renderHistory(unit);onRendered();
  $('#bedEditDialog').showModal();
 }
 function resetEditor(){
  editingUnit=null;pending=null;$('#bedSettingsForm').reset();$('#bedConfirmForm').reset();$('#bedConfirmDialog').close();$('#bedEditDialog').close();
  $('#bedUnitHistory').replaceChildren();$('#bedUnitTimeline').replaceChildren();message('#bedEditFeedback','');onRendered();
 }
 function closeEditor(){if(!busy)resetEditor();}
 $('#closeBedEdit').onclick=closeEditor;$('#cancelBedEdit').onclick=closeEditor;
 $('#bedEditDialog').addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
 async function load(){
  if(getSession()?.role!=='sysadmin'||busy)return;
  const current=++generation;resetEditor();message('#bedSettingsFeedback','');$('#bedSettingsContent').classList.add('hidden');
  if(!isEnabled()){message('#bedSettingsFeedback','床數管理尚未啟用，請聯絡系統維護人員完成資料庫更新。',true);return;}
  setBusy(true);
  try{
   const data=await rpc('nrop_admin_bed_settings');
   if(current!==generation||getSession()?.role!=='sysadmin')return;
   settings=data;
   $('#bedHospitalTotal').textContent=data.units.filter(u=>['ward','special'].includes(u.type)).reduce((total,u)=>total+u.beds,0)+' 床';
   renderCards();$('#bedSettingsContent').classList.remove('hidden');onRendered();
  }catch(error){if(current===generation)message('#bedSettingsFeedback',errorMessage(error),true);}
  finally{setBusy(false);}
 }
 $('#bedEffectiveDate').onchange=()=>renderPreview();
 $('#reloadBedSettings').onclick=()=>void load();
 $('#bedSettingsForm').onsubmit=e=>{e.preventDefault();void(async()=>{
  if(busy||getSession()?.role!=='sysadmin'||!$('#bedSettingsForm').reportValidity())return;
  const unit=settings?.units.find(u=>u.id===editingUnit);if(!unit||!$('#bedEditDialog').open)return;
  const epoch=generation,owner=getSession().userId;
  setBusy(true);message('#bedEditFeedback','');
  try{
   pending=await rpc('nrop_prepare_bed_change',{p_unit:unit.id,p_date:$('#bedEffectiveDate').value,p_beds:Number($('#newBeds').value),p_version:unit.version,p_reason:$('#bedReason').value.trim()});
   if(epoch!==generation||getSession()?.userId!==owner||getSession()?.role!=='sysadmin'){pending=null;return;}
   $('#bedConfirmForm').reset();message('#bedConfirmFeedback','');
   $('#bedConfirmSummary').textContent=`${pending.unit}：${pending.oldBeds} 床 → ${pending.newBeds} 床\n生效日期：${pending.effectiveDate}（N／D／E 三班）\n${pending.effectiveDate} 之前的母數維持不變。${pending.reason?'\n調整原因：'+pending.reason:''}`;
   pending.userId=getSession().userId;pending.email=getSession().email;
   $('#bedConfirmDialog').showModal();
  }catch(error){if(epoch===generation)message('#bedEditFeedback',errorMessage(error),true);}
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
  let saved=false;
  try{
   await confirmChange({requestId:pending.requestId,email,password,expectedUserId:pending.userId});
   saved=true;
   resetEditor();
   await onSaved();
   setBusy(false);await load();message('#bedSettingsFeedback','床數設定已儲存，修改時間與操作者已記錄；生效當天三班套用，之前日期保留原母數。');
  }catch(error){message(saved?'#bedSettingsFeedback':'#bedConfirmFeedback',saved?'床數已儲存，但重新讀取失敗，請重新整理確認紀錄。':errorMessage(error)+' 若無法確認結果，請先重新整理床數設定再重試。',true);}
  finally{setBusy(false);}
 })();};
 return {load,isBusy:()=>busy,clear(){generation++;resetEditor();settings=null;$('#bedUnitCards').replaceChildren();$('#bedSettingsContent').classList.add('hidden');}};
}
