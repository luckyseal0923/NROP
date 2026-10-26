import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
let source;
async function mount({user='sys',loginError=null,rpcError=null}={}){
 if(!source)source=(await build({entryPoints:['src/api.js'],bundle:true,write:false,format:'iife',globalName:'api',platform:'browser',
  define:{'import.meta.env.VITE_SUPABASE_URL':'"https://auth.example.invalid"','import.meta.env.VITE_SUPABASE_ANON_KEY':'"public-test-key"'},
  plugins:[{name:'stub-client',setup(b){b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'client',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const createClient=(...args)=>window.__createClient(...args);'}));}}]
 })).outputFiles[0].text;
 const dom=new JSDOM('',{url:'https://nrop.example.invalid',runScripts:'outside-only'}),w=dom.window,clients=[];
 w.__createClient=(url,key,options)=>{const calls=[],client={options,calls,auth:{async signInWithPassword(params){calls.push(['signIn',params]);return{data:{user:{id:user}},error:loginError};},async signOut(params){calls.push(['signOut',params]);return{};}},async rpc(name,params){calls.push(['rpc',name,params]);return{data:{beds:40},error:rpcError};}};clients.push(client);return client;};
 w.eval(source);return{dom,w,clients};
}
test('床數確認使用獨立記憶體 Auth，密碼只交給 Auth，RPC 不含密碼或金鑰',async()=>{
 const {dom,w,clients}=await mount();
 try{
  const result=await w.api.confirmBedChange({requestId:'request',email:'sys@example.invalid',password:'synthetic-test-password',expectedUserId:'sys'});
  assert.equal(result.beds,40);assert.equal(clients.length,2);assert.deepEqual(clients[0].calls,[]);
  const confirmation=clients[1];assert.equal(confirmation.options.auth.persistSession,false);assert.equal(confirmation.options.auth.autoRefreshToken,false);assert.equal(confirmation.options.auth.detectSessionInUrl,false);
  assert.deepEqual(JSON.parse(JSON.stringify(confirmation.calls[1])),['rpc','nrop_confirm_bed_change',{p_request:'request'}]);
  assert.deepEqual(JSON.parse(JSON.stringify(confirmation.calls.at(-1))),['signOut',{scope:'local'}]);
  assert.equal(w.localStorage.length,0);assert.equal(w.sessionStorage.length,0);
 }finally{dom.window.close();}
});
test('錯誤密碼、其他帳號及後端拒絕都不會影響原工作階段，最後清理確認工作階段',async()=>{
 for(const options of [{loginError:{message:'invalid'}},{user:'another'},{rpcError:{message:'denied'}}]){
  const {dom,w,clients}=await mount(options);
  try{
   await assert.rejects(w.api.confirmBedChange({requestId:'request',email:'sys@example.invalid',password:'synthetic-test-password',expectedUserId:'sys'}));
   assert.deepEqual(clients[0].calls,[]);assert.equal(clients[1].calls.at(-1)[0],'signOut');
   if(options.loginError||options.user)assert.equal(clients[1].calls.filter(c=>c[0]==='rpc').length,0);
  }finally{dom.window.close();}
 }
});
