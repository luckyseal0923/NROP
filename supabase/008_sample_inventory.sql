-- 正式啟用前由 SQL Editor 執行；僅盤點，不修改或清除資料。
-- is_sample 是範例來源標記，不是另一個資料區；同筆範例修改後仍保留標記。
select is_sample as imported_sample,count(*) as records,
 min(report_date) as first_date,max(report_date) as last_date
from nrop.records group by is_sample order by is_sample desc;

select unit_id,count(*) filter(where is_sample) as sample_records,
 count(*) filter(where not is_sample) as added_records,
 min(report_date) filter(where not is_sample) as first_added_date
from nrop.records group by unit_id order by unit_id;

-- 若保留人工新增的住院填報，清除範例前應核對其首班期初基準。
select distinct on (r.unit_id) r.unit_id,r.report_date,r.shift,r.opening_patients
from nrop.records r join nrop.units u on u.id=r.unit_id
where not r.is_sample and u.kind in ('ward','special')
order by r.unit_id,r.report_date,nrop.order_of_shift(r.shift);
