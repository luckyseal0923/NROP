import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key, {
  auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, flowType: 'pkce' },
  global: { fetch: (input,init={})=>fetch(input,{...init,signal:init.signal||AbortSignal.timeout(15000)}) }
}) : null;

export async function rpc(name, params = {}) {
  if (!supabase) throw new Error('尚未設定 Supabase，請參閱安裝說明設定 .env.local。');
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}

// 獨立、僅存記憶體的驗證工作階段，避免切換主畫面正在使用的帳號。
export async function confirmBedChange({requestId,email,password,expectedUserId}) {
  if(!supabase)throw new Error('尚未設定 Supabase');
  const confirmation=createClient(url,key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'nrop-bed-confirm-'+crypto.randomUUID()},
    global:{fetch:(input,init={})=>fetch(input,{...init,signal:init.signal||AbortSignal.timeout(15000)})}
  });
  try {
    const {data,error}=await confirmation.auth.signInWithPassword({email,password});
    if(error)throw error;
    if(data.user?.id!==expectedUserId)throw new Error('請輸入目前登入系統管理者本人的帳號密碼');
    const result=await confirmation.rpc('nrop_confirm_bed_change',{p_request:requestId});
    if(result.error)throw result.error;
    return result.data;
  } finally {
    // 只登出此次確認用的工作階段；不登出其他分頁或平台。
    try{await confirmation.auth.signOut({scope:'local'});}catch{}
  }
}

// 申請前先確認 Auth 已取消驗證信，避免仍沿用舊設定而寄出使用者不要的信件。
export async function requireApprovalOnlySignup() {
  const res=await fetch(url.replace(/\/$/,'')+'/auth/v1/settings',{headers:{apikey:key},signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw new Error('無法確認註冊設定，請稍後再試。');
  const settings=await res.json();
  if(settings.mailer_autoconfirm!==true)throw new Error('管理者審核註冊尚未啟用，請管理者將 Supabase 的 ENABLE_EMAIL_AUTOCONFIRM 設為 true 並重啟後再申請。');
}

export function errorMessage(error) {
  const message = error?.message || '連線失敗，請稍後再試。';
  if (/Invalid login credentials/i.test(message)) return 'Email 或密碼錯誤。';
  if (/Email not confirmed/i.test(message)) return '此帳號的註冊尚未完成，請在管理者啟用免驗證信設定後，使用原 Email 重新申請。';
  if (/User already registered/i.test(message)) return '此 Email 已有帳號，請直接登入。';
  if (/Failed to fetch|NetworkError|fetch failed|503|Site not available|Unexpected token|timed out|aborted/i.test(message)) return 'Supabase 暫時無法連線，請檢查服務狀態後重試。';
  if (/Could not find the function|schema cache/i.test(message)) return '尚未安裝 NROP 資料庫，請先在 SQL Editor 執行 INSTALL.sql。';
  if (/rate limit/i.test(message)) return '嘗試次數過多，請稍後再試。';
  if (/signups not allowed/i.test(message)) return 'Supabase 尚未開放註冊，請聯絡系統管理者。';
  return message.length > 240 ? '操作失敗，請檢查服務狀態或聯絡系統管理者。' : message;
}
