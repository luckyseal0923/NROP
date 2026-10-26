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

## 3. 確認重設信的返回網址

本機目前為 `http://127.0.0.1:5173`。Coolify 中 `ADDITIONAL_REDIRECT_URLS` 需要保留原有平台網址並追加這個本機網址；Compose 會對應到 Auth 的 `GOTRUE_URI_ALLOW_LIST`。之後上線時加入正式 NROP 網址，避免重設信返回錯誤網頁。本機重設連結需在發起操作的同一台電腦、同一瀏覽器開啟。

## 4. 測試

先完成自己的帳號註冊與 NROP 管理者核准，再由你在登入頁輸入自己的 Email，按「忘記密碼」。檢查收件匣與垃圾郵件，確認重設信確實到達且連結可回到網站。只看到「已寄出」提示，不能當成信件送達的證據。

若沒有收到，查看 `supabase-auth` 的 Runtime Logs：先找 SMTP 認證失敗、連線逾時或寄件者錯誤。只提供必要的錯誤片段，不顯示密碼。Gmail 寄信數量與帳戶政策有額度限制，正式使用前須依實際帳戶確認。

目前代理只完成唯讀檢查與教學文件；未填 SMTP 憑證、未建立 Google 應用程式密碼、未寄出測試信。
