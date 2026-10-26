-- 範例與填報共用同一資料區；is_sample 僅保留來源，方便正式啟用前清除。
-- 重跑不覆蓋任何既有紀錄，包括人工填報。
-- 將原前端 2026-08-01 起的演算法搬到資料庫，固定匯入截至 2026-10-25 的快照。
begin;
do $$
declare
 u nrop.units; d date; s text; si integer; ui integer; day_index integer;
 patients integer; before_count integer; admitted integer; discharged integer; tin integer; tout integer; deaths integer;
 next_count integer; staff integer; lo integer; hi integer; body jsonb; record_status text;
begin
 for u in select * from nrop.units order by sort_order loop
  ui:=u.sort_order;
  patients:=greatest(1,round(u.beds*(0.58+(ui%5)*0.025))::integer);
  for d in select generate_series('2026-08-01'::date,'2026-10-25'::date,'1 day'::interval)::date loop
   day_index:=d-'2026-08-01'::date;
   for si in 0..2 loop
    s:=(array['N','D','E'])[si+1]; body:='{}'; record_status:='submitted'; before_count:=patients;
    if u.kind in ('ward','special') then
     admitted:=case when (ui+day_index+si*2)%9=0 then 1 else 0 end;
     discharged:=case when (ui*2+day_index+si)%11=0 then 1 else 0 end;
     tin:=case when (ui+day_index+si)%17=0 then 1 else 0 end;
     tout:=case when (ui*3+day_index+si)%19=0 then 1 else 0 end;
     deaths:=case when (ui+day_index*3+si)%127=0 then 1 else 0 end;
     lo:=greatest(0,floor(u.beds*0.48)::integer); hi:=greatest(1,floor(u.beds*0.78)::integer);
     next_count:=patients+admitted-discharged+tin-tout-deaths;
     if next_count<lo then discharged:=0;tout:=0;deaths:=0;next_count:=patients+admitted+tin; end if;
     if next_count>hi then admitted:=0;tin:=0;next_count:=patients-discharged-tout-deaths; end if;
     patients:=next_count;
     staff:=greatest(1,round(u.beds/(case s when 'D' then 9.0 when 'E' then 12.0 else 14.0 end))::integer+(ui+si)%2);
     body:=jsonb_build_object('staff',staff,'住院',admitted,'出院',discharged,'轉入',tin,'轉出',tout,
       '死亡',deaths,'病危',case when (ui*3+day_index+si)%71=0 then 1 else 0 end);
     -- 舊 DEMO 未分本科／隔離分類，保留合計；不虛構各分類。
     if d='2026-08-12' and s='E' and u.id='8B' then record_status:='draft'; end if;
     if d='2026-08-19' and s='N' and u.id='ICU-2' then record_status:='draft';body:=body||'{"staff":null}'::jsonb; end if;
     if d='2026-09-01' and s='E' and u.id='9A' then record_status:='empty'; end if;
    else
     body:=jsonb_build_object('staff',greatest(1,round(u.beds/(case s when 'D' then 10.0 else 14.0 end))::integer));
     if u.kind='emergency' then body:=body||jsonb_build_object('visits',12+(day_index*3+si*5)%15,
       'referralIn',case when (day_index+si)%7=0 then 1 else 0 end,'referralOut',case when (day_index+si)%9=0 then 1 else 0 end,
       'admitted',2+(day_index+si)%4,'observation',8+(day_index*2+si)%9,
       'deaths',case when (day_index+si)%43=0 then 1 else 0 end,'surgeries',case when (day_index+si)%6=0 then 1 else 0 end);
     elsif u.kind='delivery' then body:=body||jsonb_build_object('visits',1+(day_index+si)%4,'observation',(day_index+si)%3,
       'waiting',(day_index*2+si)%3,'cesarean',case when (day_index+si)%5=0 then 1 else 0 end,
       'naturalBirth',case when (day_index+si)%4=0 then 1 else 0 end,'drSurgery',case when (day_index+si)%5=0 then 1 else 0 end);
     elsif u.kind='operatingRoom' then body:=body||jsonb_build_object('inCount',case s when 'D' then 10+day_index%7 when 'E' then 3+day_index%4 else day_index%3 end,
       'outCount',case s when 'D' then 10+day_index%7 when 'E' then 3+day_index%4 else day_index%3 end);
     elsif u.kind='nursingHome' then body:=body||jsonb_build_object('residents',31,'occupiedBeds',31,'reserved',6,
       'admitted',case when (day_index+si)%29=0 then 1 else 0 end,'discharged',case when (day_index+si)%31=0 then 1 else 0 end);
     elsif u.kind='dialysis' then body:=body||jsonb_build_object('hemodialysisOutpatient',case s when 'D' then 25+day_index%8 when 'E' then 16+day_index%7 else 0 end,
       'hemodialysisInpatient',case s when 'D' then 3+day_index%3 when 'E' then 1+day_index%2 else 0 end,
       'hemodialysisCritical',0,'peritonealDialysis',(day_index+si)%5);
     end if;
    end if;
    insert into nrop.records(dataset,is_sample,report_date,shift,unit_id,payload,status,opening_patients,patients,updated_at)
    values('live',true,d,s,u.id,body,record_status,case when u.kind in ('ward','special') then before_count else 0 end,
      case when u.kind in ('ward','special') then patients else null end,
      (d::text||' '||case s when 'N' then '07:45' when 'D' then '15:45' else '23:45' end||':00+08')::timestamptz)
    on conflict do nothing;
   end loop;
  end loop;
 end loop;
end $$;
commit;
-- 初次應有 28 單位 × 86 日 × 3 班 = 7,224 筆範例，與後續填報一起查詢。
select count(*) as record_count,count(*) filter(where is_sample) as sample_count,min(report_date) as first_date,max(report_date) as last_date from nrop.records;
