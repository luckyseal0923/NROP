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
