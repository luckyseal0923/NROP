import { config } from 'dotenv';
config({path:'.env.local',quiet:true});
const url=process.env.VITE_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.VITE_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if(!url||!key) { console.error('缺少公開網址或 anon key');process.exit(1); }
try {
  console.log('Supabase 主機：'+new URL(url).hostname);
  for(const [path,method] of [['/auth/v1/settings','GET'],['/rest/v1/rpc/nrop_public_config','POST']]) {
    const res=await fetch(url.replace(/\/$/,'')+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
      ...(method==='POST'?{body:'{}'}:{}),signal:AbortSignal.timeout(15000)});
    console.log(path+' HTTP '+res.status);
    if(res.ok&&method==='POST') {
      const data=await res.json();console.log(JSON.stringify({units:data?.units?.length,dataArea:data?.dataArea||'legacy',latestRecordDate:data?.latestRecordDate,registrationOpen:data?.registrationOpen}));
      if(data?.dataArea!=='shared'){console.error('資料庫尚未更新為單一資料區，請執行 UPGRADE_005_007.sql。');process.exitCode=1;}
    }
    if(!res.ok) process.exitCode=1;
  }
} catch { console.error('連線失敗或逾時；未輸出任何金鑰。');process.exitCode=1; }
