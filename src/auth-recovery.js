// 登入憑證仍限本分頁；只有短期 PKCE 驗證資料供同來源的信件分頁使用。
export function createAuthStorage({session,shared,storageKey,now=Date.now,ttl=60*60*1000}) {
 const verifierKey=storageKey+'-code-verifier',sharedKey='nrop-pkce:'+verifierKey;
 const removeShared=()=>{try{shared().removeItem(sharedKey);}catch{}};
 return {
  getItem(key){
   if(key!==verifierKey)return session.getItem(key);
   let raw=null;
   try{raw=shared().getItem(sharedKey);}catch{}
   if(raw!==null){
    let item;
    try{item=JSON.parse(raw);}catch{}
    if(typeof item?.value==='string'&&Number.isFinite(item.expiresAt)&&item.expiresAt>now())return item.value;
    removeShared();session.removeItem(key);return null;
   }
   // 相容升級前已在原分頁發起、尚未完成的流程。
   return session.getItem(key);
  },
  setItem(key,value){
   if(key!==verifierKey){session.setItem(key,value);return;}
   session.removeItem(key);removeShared();
   try{shared().setItem(sharedKey,JSON.stringify({value,expiresAt:now()+ttl}));}
   catch{session.setItem(key,value);}
  },
  removeItem(key){
   session.removeItem(key);
   if(key===verifierKey)removeShared();
  }
 };
}

// 明確交換 PKCE code，使用交換結果的 recovery 類型，不依賴 SDK 初始化事件。
export async function completeAuthRedirect({auth,location,history}) {
 const url=new URL(location.href),hash=new URLSearchParams(url.hash.slice(1));
 const code=url.searchParams.get('code');
 const hasError=url.searchParams.has('error')||url.searchParams.has('error_description')||hash.has('error')||hash.has('error_description');
 if(!code&&!hasError)return {recovery:false};
 try{
  if(hasError)throw new Error('驗證連結已失效，請重新按「忘記密碼」取得最新信件。');
  const {data,error}=await auth.exchangeCodeForSession(code);
  if(error){
   if(error.name==='AuthPKCECodeVerifierMissingError'||error.code==='pkce_code_verifier_not_found')
    throw new Error('找不到這次重設的驗證資料，請用原本的瀏覽器重新按「忘記密碼」，再開啟最新信件。若瀏覽器封鎖儲存空間，請在原本的 NROP 分頁開啟連結。');
   throw new Error('驗證連結無法完成驗證，可能已過期、已使用或有較新的申請。請重新按「忘記密碼」取得最新信件。');
  }
  if(!data?.session)throw new Error('未取得有效的驗證工作階段，請重新按「忘記密碼」。');
  return {recovery:data.redirectType==='PASSWORD_RECOVERY'};
 }finally{
  for(const key of ['code','error','error_code','error_description'])url.searchParams.delete(key);
  if(hasError){
   for(const key of ['error','error_code','error_description'])hash.delete(key);
   url.hash=hash.toString();
  }
  history.replaceState(history.state,'',url.toString());
 }
}
