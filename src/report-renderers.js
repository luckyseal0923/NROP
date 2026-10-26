import { units, operationalUnits, allLoginUnits, nursingHomeStaffFields, specialStaffFields, shifts, events, admissionFieldsByUnit, admissionExportFields } from './catalog.js';
import { $, $$, today } from './dom.js';
export function createReporting({store,persistRecord,alertFrom}) {
let session=null;
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
  return {value:prior?.patients??opening?.patients??current?.opening??0,ready:prior?.status==='submitted'||!!opening||(!prior&&!!current?.baselineReady)};
}
function renderEntry(){
  const operational=operationalUnits.find(x=>x.id===session.unit);
  $('#standardEntryGrid').classList.toggle('hidden',!!operational);$('#specialEntryView').classList.toggle('hidden',!operational);
  renderCalculationGuide(operational);renderProgress();
  if(operational){renderSpecialForm();return}
  const u=units.find(x=>x.id===session.unit),data=store.get(),rec=data[key($('#entryDate').value,$('#entryShift').value,session.unit)]||emptyRecord(),base=getBase();
  $('#bedCount').textContent=u.beds;$('#openingControls').classList.toggle('hidden',session.role==='unit'||Object.keys(data).some(k=>k.endsWith('|'+session.unit)));$('#staff').value=rec.staff??'';renderEventFields(rec);$('#previous').value=base.value;
  $('#previousNotice').classList.toggle('hidden',base.ready);$('#previousNotice').textContent='前一班尚未正式送出，目前可暫存；前班完成後系統將依最新資料重新計算。';
  setStatus(rec.status);calculate();
}
function renderCalculationGuide(operational){
  const common='實際上班人力可填至小數點第三位；其餘人數、人次及床數填非負整數，沒有數值請填 0。';
  let rules;
  if(!operational){
    rules=['住院人數 ＝ 前班住院人數 ＋ 住院 − 出院 ＋ 機構內轉入 − 機構內轉出 − 死亡',
      '空床數 ＝ 有效床數 − 住院人數；超床數 ＝ 住院人數 − 有效床數，兩者最低均為 0。',
      '病危僅作狀態註記，不列入計算，也不影響住院或空床數。'];
    const parts=admissionFieldsByUnit[session.unit];
    if(parts)rules.push('住院合計 ＝ '+parts.map(([,label])=>label).join(' ＋ ')+'，兩欄相加後計入住院人數。');
  }else{
    const byType={
      emergency:['來診、轉診入、轉診出、住院、留觀、死亡及手術，均由人員填寫當班數值。',
        '全日來診人數、住院人次分別為 N 班 ＋ D 班 ＋ E 班；當日留觀顯示 E 班留觀人數。',
        '急診資料於特殊單位營運統整呈現，住院欄位不套用病房的前班住院人數公式。'],
      delivery:['來診、留觀、待產、剖腹產、自然產及 DR 手術，均由人員填寫當班數值。',
        '全日來診、自然產及剖腹產，分別為 N 班 ＋ D 班 ＋ E 班。'],
      operatingRoom:['IN、OUT 分開填寫當班數值。',
        '全日 IN ＝ N 班 IN ＋ D 班 IN ＋ E 班 IN；全日 OUT 以相同方式加總。'],
      nursingHome:['上班人力 ＝ 護理師 ＋ 護佐，由系統自動合計；兩種職類分開填寫，均可至小數點第三位。',
        '住民人數、實際使用床數、保留床位、住院及出院，由人員填寫當班數值。',
        '當日住民與保留床位採 E 班數值；空床 ＝ 參考床數 − E 班住民人數 − E 班保留床位，最低為 0。',
        '三班護理師、護佐及上班人力，分別為 N 班 ＋ D 班 ＋ E 班。'],
      dialysis:['血液透析分門診、住院、重症三欄，分別填寫當班人次；腹膜透析另行填寫。',
        '全日血液透析門診、住院、重症，分別為各自的 N 班 ＋ D 班 ＋ E 班；腹膜透析也分開加總。']
    };
    rules=byType[operational.type]||['各欄由人員填寫當班數值。'];
  }
  $('#calculationRules').replaceChildren(...[...rules,common].map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));
}
function operationalKey(date,shift,unit){return `OPS|${date}|${shift}|${unit}`}
function hasNursingHomeStaffSplit(record){return nursingHomeStaffFields.every(field=>record[field]!==undefined&&record[field]!==null&&record[field]!=='')}
function nursingHomeStaff(record){return hasNursingHomeStaffSplit(record)?nursingHomeStaffFields.reduce((sum,field)=>sum+Math.round((Number(record[field])||0)*1000),0)/1000:record.staff||0}
function renderSpecialForm(){
  const u=operationalUnits.find(x=>x.id===session.unit),data=store.get(),rec=data[operationalKey($('#specialDate').value,$('#specialShift').value,u.id)]||{status:'empty'};
  $('#specialFormTitle').textContent=`${u.id}每日動態填報`;$('#specialBeds').textContent=`${u.beds} 床`;
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
function renderProgress(){const data=store.get(),operational=operationalUnits.some(u=>u.id===session.unit),date=$(operational?'#specialDate':'#entryDate').value;$('#shiftProgress').innerHTML=shifts.map(s=>{const recordKey=operational?operationalKey(date,s,session.unit):key(date,s,session.unit),r=data[recordKey]||emptyRecord(),txt=r.status==='submitted'?'已完成':r.status==='draft'?'已暫存':'待填報';return `<div class="side-item"><div><b>${s} 班</b><small>${s==='N'?'00:00–08:00':s==='D'?'08:00–16:00':'16:00–24:00'}</small></div><span class="status ${r.status}">${txt}</span></div>`}).join('')}

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
  const blob=new Blob(['\ufeff'+head+body],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`護理動態_${date}_${shift}.csv`;a.click();URL.revokeObjectURL(a.href);
};
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.add('hidden'),2300)}

return {
  getBase,
  render(member){session=member;if(!session)return;renderEntry();if(session.role!=='unit')renderDashboard();},
  clear(){
    session=null;
    ['#unitTable','#occupancyChart','#pendingList','#specialOpsTable','#alertTable','#eventFields','#specialFields','#shiftProgress','#calculationRules'].forEach(id=>$(id).replaceChildren());
    $$('.metric .value').forEach(el=>el.textContent='—');
    ['#staff','#previous'].forEach(id=>$(id).value='');
  }
};
}
