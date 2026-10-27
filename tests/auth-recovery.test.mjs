import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {JSDOM} from 'jsdom';
import {createAuthStorage,completeAuthRedirect} from '../src/auth-recovery.js';

const memory=()=>{
 const values=new Map();
 return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
};
const storageKey='sb-auth-auth-token',verifierKey=storageKey+'-code-verifier';
function setup({failure=false}={}){
 const local=memory(),first=memory(),second=memory(),requests=[];let challenge;
 const mockFetch=async(input,options={})=>{
  const url=new URL(input),body=JSON.parse(options.body||'{}');requests.push({path:url.pathname,body});
  if(url.pathname.endsWith('/recover')){challenge=body.code_challenge;return Response.json({});}
  assert.ok(url.pathname.endsWith('/token'));assert.equal(url.searchParams.get('grant_type'),'pkce');
  assert.equal(body.auth_code,'synthetic-code');
  assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'),challenge);
  if(failure)return Response.json({code:'flow_state_expired',msg:'Synthetic expired flow'}, {status:400});
  return Response.json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,user:{id:'synthetic-user'}});
 };
 const adapter=session=>createAuthStorage({session,shared:()=>local,storageKey});
 const client=storage=>createClient('https://auth.example.invalid','synthetic-public-key',{
  auth:{storageKey,storage,flowType:'pkce',persistSession:true,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:mockFetch}
 });
 return {local,first,second,requests,adapter,client};
}

test('真實 SDK：原分頁申請後，新分頁交換 PKCE 可辨識 recovery，憑證只在新分頁',async()=>{
 const {local,first,second,requests,adapter,client}=setup();local.setItem('unrelated','keep');
 const sender=client(adapter(first)),receiver=client(adapter(second));
 const dom=new JSDOM('',{url:'https://nrop.example.invalid/?code=synthetic-code&keep=1'});
 try{
  assert.equal((await sender.auth.resetPasswordForEmail('member@example.invalid',{redirectTo:'https://nrop.example.invalid'})).error,null);
  assert.equal(first.values.size,0);assert.ok(local.getItem('nrop-pkce:'+verifierKey));
  const events=[];receiver.auth.onAuthStateChange(event=>events.push(event));
  const result=await completeAuthRedirect({auth:receiver.auth,location:dom.window.location,history:dom.window.history});
  assert.equal(result.recovery,true);assert.ok(events.includes('SIGNED_IN'));
  // 此版本只發出 SIGNED_IN，證明不能繼續依賴 PASSWORD_RECOVERY 初始化事件。
  assert.equal(events.includes('PASSWORD_RECOVERY'),false);
  assert.equal(dom.window.location.search,'?keep=1');assert.equal(first.getItem(storageKey),null);
  assert.ok(second.getItem(storageKey).includes('synthetic-access'));
  assert.equal(local.values.size,1);assert.equal(local.getItem('unrelated'),'keep');
  assert.equal(requests.length,2);
 }finally{sender.auth.stopAutoRefresh();receiver.auth.stopAutoRefresh();dom.window.close();}
});

test('真實 SDK：缺少 verifier 時清除網址代碼並提供可操作錯誤，不交換或開啟重設',async()=>{
 const {adapter,client,second,requests}=setup();const receiver=client(adapter(second));
 const dom=new JSDOM('',{url:'https://nrop.example.invalid/?code=synthetic-code'});
 try{
  await assert.rejects(completeAuthRedirect({auth:receiver.auth,location:dom.window.location,history:dom.window.history}),/找不到這次重設的驗證資料/);
  assert.equal(requests.length,0);assert.equal(second.getItem(storageKey),null);assert.equal(dom.window.location.search,'');
 }finally{receiver.auth.stopAutoRefresh();dom.window.close();}
});

test('真實 SDK：過期或使用過的流程不能取得重設工作階段，驗證資料會清理',async()=>{
 const {local,adapter,client,first,second}=setup({failure:true});const sender=client(adapter(first)),receiver=client(adapter(second));
 const dom=new JSDOM('',{url:'https://nrop.example.invalid/?code=synthetic-code'});
 try{
  await sender.auth.resetPasswordForEmail('member@example.invalid');
  await assert.rejects(completeAuthRedirect({auth:receiver.auth,location:dom.window.location,history:dom.window.history}),/可能已過期、已使用/);
  assert.equal(local.values.size,0);assert.equal(second.getItem(storageKey),null);assert.equal(dom.window.location.search,'');
 }finally{sender.auth.stopAutoRefresh();receiver.auth.stopAutoRefresh();dom.window.close();}
});

test('短期驗證資料逾時清除，其他儲存內容不受影響，舊原分頁仍可讀取',()=>{
 const session=memory(),local=memory();let time=0;
 const storage=createAuthStorage({session,shared:()=>local,storageKey,now:()=>time,ttl:100});
 session.setItem(verifierKey,'legacy');assert.equal(storage.getItem(verifierKey),'legacy');
 storage.setItem(storageKey,'session-only');storage.setItem(verifierKey,'new');
 assert.equal(local.values.size,1);assert.equal(session.getItem(verifierKey),null);
 assert.equal(storage.getItem(verifierKey),'new');time=100;
 assert.equal(storage.getItem(verifierKey),null);assert.equal(local.values.size,0);
 assert.equal(storage.getItem(storageKey),'session-only');
});

test('封鎖 localStorage 時同分頁可繼續，非驗證資料只使用 sessionStorage',()=>{
 const session=memory(),storage=createAuthStorage({session,shared:()=>{throw new Error('blocked');},storageKey});
 storage.setItem(verifierKey,'synthetic');assert.equal(storage.getItem(verifierKey),'synthetic');
 storage.setItem(storageKey,'synthetic-session');assert.equal(session.getItem(storageKey),'synthetic-session');
 storage.removeItem(verifierKey);assert.equal(storage.getItem(verifierKey),null);
});

test('一般登入驗證不誤開密碼框，失效信件顯示錯誤且清除網址錯誤資訊',async()=>{
 for(const scenario of ['normal','error']){
  const dom=new JSDOM('',{url:scenario==='normal'?'https://nrop.example.invalid/?code=synthetic-code':'https://nrop.example.invalid/#error=access_denied&error_description=expired'});
  let exchanges=0;const auth={async exchangeCodeForSession(){exchanges++;return{data:{session:{},redirectType:null},error:null};}};
  try{
   if(scenario==='normal')assert.equal((await completeAuthRedirect({auth,location:dom.window.location,history:dom.window.history})).recovery,false);
   else await assert.rejects(completeAuthRedirect({auth,location:dom.window.location,history:dom.window.history}),/驗證連結已失效/);
   assert.equal(exchanges,scenario==='normal'?1:0);assert.equal(dom.window.location.search,'');assert.equal(dom.window.location.hash,'');
  }finally{dom.window.close();}
 }
});
