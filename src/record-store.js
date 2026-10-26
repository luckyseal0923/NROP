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
  constructor(rpc, operationalIds) { this.rpc=rpc; this.operationalIds=operationalIds; this.data={}; this.openings=[]; this.capacities=[]; this.capacitiesEnabled=false; this.generation=0; }
  get() { return this.data; }
  clear() { this.generation++; this.data={}; this.openings=[]; this.capacities=[]; }
  bedsAt(unit,date,fallback) {
    if(!this.capacitiesEnabled)return fallback;
    const found=this.capacities.filter(row=>row.unit===unit&&row.effectiveDate<=date).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate))[0];
    if(!found)throw new Error('缺少 '+unit+' 在 '+date+' 的床數設定，請重新整理');
    return found.beds;
  }
  async load(from, to) {
    const generation=++this.generation;
    try {
      const [rows,openings,capacities]=await Promise.all([
        this.rpc('nrop_list_records',{p_dataset:'live',p_from:from,p_to:to}),
        this.rpc('nrop_list_openings',{p_dataset:'live'}),
        this.capacitiesEnabled?this.rpc('nrop_list_bed_capacities',{p_from:from,p_to:to}):[]
      ]);
      if(generation!==this.generation) return false;
      this.data=Object.fromEntries(rows.map(row=>[recordKey(row,this.operationalIds),row.record]));
      this.openings=openings;
      this.capacities=capacities;
      return true;
    } catch(error) { if(generation===this.generation){this.data={};this.openings=[];this.capacities=[];} throw error; }
  }
}

export function escapeHtml(value) {
  return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
