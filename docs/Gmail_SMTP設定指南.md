# 使用專用 Gmail 設定 Supabase SMTP

使用者選擇先以專用 Gmail 測試。以下由使用者自行操作，應用程式密碼只填 Coolify，不放進對話、`.env.local`、GitHub 或文件。

## 1. 準備寄件用 Google 帳戶

登入你要專門用來寄系統信件的 Gmail。先開啟 [Google 兩步驟驗證](https://myaccount.google.com/signinoptions/two-step-verification)，再前往 [應用程式密碼](https://myaccount.google.com/apppasswords)，以「Supabase SMTP」作為識別名稱產生密碼。Google 的應用程式密碼為 16 碼，需先啟用兩步驟驗證；部分機構或進階保護帳號可能不提供此選項。[Google 官方說明](https://support.google.com/accounts/answer/185833?hl=zh-Hant)

## 2. 在 Coolify 填 SMTP 來源變數

進入 `supabase-test` → Environment Variables，搜尋 `SMTP`。使用下列 `SMTP_*` 來源欄位；Compose 會將它們對應到 Auth 容器中的 `GOTRUE_SMTP_*`。

| 變數 | 填入內容 |
| --- | --- |
| SMTP_HOST | smtp.gmail.com |
| SMTP_PORT | 587 |
| SMTP_USER | 專用 Gmail 完整地址 |
| SMTP_PASS | Google 產生的 16 碼應用程式密碼，去除分組空格 |
| SMTP_ADMIN_EMAIL | 與 SMTP_USER 相同的 Gmail 地址 |
| SMTP_SENDER_NAME | NROP 護理即時動態平台 |

Gmail 的 SMTP 主機為 smtp.gmail.com，587 使用 STARTTLS。[Google SMTP 官方文件](https://developers.google.com/workspace/gmail/imap/imap-smtp)

每個欄位編輯後按 Update Variable。全部完成後執行 Restart current version，等待啟動完成。不要更改現有資料庫名稱、金鑰或其他平台設定。

註冊仍採人工審核，保留 `ENABLE_EMAIL_AUTOCONFIRM=true`；SMTP 用於忘記密碼等信件，不會因此自動把註冊改回寄驗證信。

## 3. 確認重設信的驗證網址及返回網址

信件連結先到 Supabase 驗證，再返回 NROP；兩段網址都必須正確。2026-10-27 使用者已收到信件；Coolify 唯讀檢查確認 `API_EXTERNAL_URL` 空白，Compose 因此採用 `http://supabase-kong:8000`，這是容器內部名稱，外部瀏覽器無法解析。`ADDITIONAL_REDIRECT_URLS` 最後一筆也誤填為 `https://nrop.wfhai.org 4.`，不符合前端送出的 NROP 返回網址。

在 `supabase-test` → Environment Variables，分別搜尋並編輯以下兩個既有來源欄位。

修改前（當次唯讀觀察）：

```dotenv
API_EXTERNAL_URL=
ADDITIONAL_REDIRECT_URLS=http://127.0.0.1:5173,http://localhost:5173,https://nrop.wfhai.org 4.
```

修改後（由使用者套用）：

```dotenv
API_EXTERNAL_URL=https://supabase-test.wfhai.org
ADDITIONAL_REDIRECT_URLS=http://127.0.0.1:5173,http://localhost:5173,https://nrop.wfhai.org
```

目前 Coolify 模板的 Auth 連結會自行附加 `/auth/v1/verify`，因此此環境的 `API_EXTERNAL_URL` 填公開根網址，不加 `:8000` 或 `/auth/v1`。未來若升級 Auth／Compose，應重新依實際版本檢查，不能將不同版本的設定範例混用。[Coolify 官方 Supabase 模板](https://github.com/coollabsio/coolify/blob/main/templates/compose/supabase.yaml)

`ADDITIONAL_REDIRECT_URLS` 由 Compose 傳入 `GOTRUE_URI_ALLOW_LIST`；網址以英文逗號分隔，不混入步驟編號。若之後已有其他平台的允許網址，保留並追加，不整份覆蓋。前端目前已傳入 `redirectTo: location.origin`；清單正確後，NROP 可返回自己的網域，不必為本次修復變更共用 Auth 的預設網站。[Supabase Redirect URLs 說明](https://supabase.com/docs/guides/auth/redirect-urls)

當次 `GOTRUE_SITE_URL` 也是空白，Compose 預設採 `SERVICE_URL_SUPABASEKONG`，可解釋錯誤信件中的 Supabase 返回目標。若日後確定此 Auth 僅服務 NROP，可另評估將 `GOTRUE_SITE_URL` 設為 `https://nrop.wfhai.org`；本次優先修正上述兩個欄位。

每個欄位按 Update Variable，全部完成後 Restart current version，等待 Running；此操作會短暫中斷該套共用 Supabase。完成後重新按「忘記密碼」取得新信件，舊信件內的網址不會自動更新。

舊網站 `NROP-20261027-02` 的 PKCE 驗證資料存在 `sessionStorage`，不同分頁不共用；另因目前 SDK 的自動返回流程遺漏 recovery 類型，僅將連結貼回原分頁仍不足以完成重設。新版 `NROP-20261027-03` 已在本機修正，需推送與部署後才生效。

新版會明確交換代碼並辨識 recovery，成功後直接開「設定新密碼」。登入憑證仍只存本分頁；短期 PKCE verifier 另外存入同來源 `localStorage` 供信件新分頁使用，一小時有效，讀取時檢查並移除過期內容，交換成功或失敗後由 SDK 清理。須使用發起申請的同一瀏覽器與裝置；無痕／另一個瀏覽器或封鎖儲存空間時，可能無法共用。儲存空間封鎖時可嘗試在原分頁開啟最新連結。

若重複申請，以最新信件為準；新申請會取代前次驗證資料。舊版發起的申請若只存原分頁，可在該原分頁相容讀取；建議部署後重新申請，才能驗收完整跨分頁流程。錯誤頁會說明重新申請方式，不會把無法驗證的連結當成重設成功。

## 4. 測試

先部署新版並確認頁尾為 `NROP-20261027-03`。完成自己的帳號註冊與 NROP 管理者核准後，由你在登入頁輸入自己的 Email，按「忘記密碼」。檢查收件匣與垃圾郵件，確認最新信件確實到達、驗證連結開頭為 `https://supabase-test.wfhai.org/auth/v1/verify`，在同一瀏覽器直接點信件連結，應返回 `nrop.wfhai.org` 並開啟「設定新密碼」。由你本人設定新密碼並重新登入；另測試取消重設會回登入、使用過的連結顯示錯誤。只看到「已寄出」或回到登入畫面，不能當成重設成功的證據。

若沒有收到，查看 `supabase-auth` 的 Runtime Logs：先找 SMTP 認證失敗、連線逾時或寄件者錯誤。只提供必要的錯誤片段，不顯示密碼。Gmail 寄信數量與帳戶政策有額度限制，正式使用前須依實際帳戶確認。

截至後續確認，使用者已正確修改網址設定；代理只做遠端唯讀檢查。前端修正在本機完成，70 項測試與建置通過，本次依使用者要求同步 GitHub；正式站部署仍待核對。未填 SMTP 憑證、未寄測試信、未變更真實密碼。部署後的實際信件與新密碼登入仍待使用者驗收。完整程式見 [修改對照](忘記密碼跨分頁與返回處理_修改對照.md)。
