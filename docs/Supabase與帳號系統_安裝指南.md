# NROP：Supabase 與帳號系統安裝指南

此步驟由你操作，不需要把資料庫密碼或 service_role 貼到對話。程式已完成本機驗證；真實資料庫仍要執行以下安裝。

## 1. 先確認新的 Supabase 可用

`.env.local` 的公開主機是 `supabase-test.wfhai.org`。2026-10-26 初次檢查曾回傳 503；使用者修正資料庫名稱並執行 SQL 後，再次檢查 `/auth/v1/settings` 與 `/rest/v1/rpc/nrop_public_config` 均為 HTTP 200，已讀到 28 單位與 DEMO 最後日期。此環境可繼續設定首位管理者；若尚未安裝的新環境，依以下步驟操作。

在 Coolify 新的 `supabase-test` 服務進入 General，確認 Database、Auth、REST、Kong、Studio 的狀態。先處理 Degraded 或 Exited 的元件，查看其 Runtime Logs；只提供錯誤片段，避免貼出整份環境變數。Domains 應為 HTTPS、你的測試網域、Kong 內部埠 8000、Path 空白；不需再開放主機的公開 5432 或 8000。

本機執行 `npm run db:check` 可再次確認。安裝前 NROP RPC 不存在可能回 404，屬預期；Auth 正常但 NROP RPC 404 時即可先建表。503 則先處理服務。

## 2. 建立資料庫與 DEMO

1. 進入這套新 Supabase 的 Studio，選 SQL Editor，新增查詢。
2. 開啟 `supabase/INSTALL.sql`，Ctrl+A 全選、複製，完整貼上後 Run。
3. 第一次執行應得到 `dataset=demo`、`record_count=7224`、日期 `2026-08-01`～`2026-10-25`。
4. 貼上 `supabase/004_verify_install.sql` 驗證：單位 28、DEMO 7224、正式 0、直接讀寫權限 false。未指定首位管理者前 active_system_admins 為 0。

整份 INSTALL 以單一交易執行，發生錯誤會回滾。若顯示 `schema nrop already exists`，先停止並檢查是否曾安裝，不要刪除 schema 或改成無條件覆蓋。

這份 SQL 不會新增固定密碼、修改其他平台的角色／RLS，也不會新增 Auth 全域 trigger。資料與成員資格在獨立 nrop schema，對外只有 public.nrop_* 的必要入口。無須更動 PostgREST 的 Exposed schemas。

## 已安裝環境追加護理部與管理者審核流程

已執行舊 INSTALL 的環境，只需完整貼上 `supabase/UPGRADE_005_006.sql` 執行。此檔包含可重跑的 005／006 更新，保留既有成員、28 個填報單位與 DEMO，新增護理部申請選項。護理部申請仍為待審核，不會自行取得管理者權限。

## 3. 設定 Auth 為不寄註冊驗證信

自架版 Auth 設定由 Coolify 的 Compose／環境變數管理，Studio 不一定有雲端版的設定選單。先檢查現有 Compose 如何對應變數，再更改該對應值，不能假設額外新增任意變數就會傳入容器。[Supabase 自架 Auth 設定](https://supabase.com/docs/guides/self-hosting/auth/config)

需要確認：

- Email 註冊已開啟：Auth 的 `GOTRUE_EXTERNAL_EMAIL_ENABLED=true`、`GOTRUE_DISABLE_SIGNUP=false`。這是共用 Supabase 的全域設定；NROP 的申請開關在網站另外管理，關閉 NROP 申請不需要關閉整套 Auth。
- Coolify 此模板使用 `ENABLE_EMAIL_AUTOCONFIRM`，由 Compose 對應到 `GOTRUE_MAILER_AUTOCONFIRM=${ENABLE_EMAIL_AUTOCONFIRM:-false}`。設為 `true`、儲存並 Restart current version，才會取消註冊驗證信。這影響共用此套 Auth 的所有平台；NROP 仍會檢查管理者核准狀態。SQL 無法更改容器環境變數。
- 註冊流程不需 SMTP。若保留「忘記密碼」寄信，仍需設定 SMTP 的主機、埠、帳號、密碼、寄件者；SMTP 密碼只放在服務端。
- `GOTRUE_SITE_URL` 對應網站網址；`GOTRUE_URI_ALLOW_LIST` 包含實際 NROP 網址，以及本機測試用的 `http://127.0.0.1:5173` / `http://localhost:5173`。共用其他平台時保留原有允許網址，再追加 NROP。[Redirect URLs 說明](https://supabase.com/docs/guides/auth/redirect-urls)
- Auth 的最低密碼長度使用 `GOTRUE_PASSWORD_MIN_LENGTH=6`；網頁已要求 6 碼與英文、數字。若要讓 Auth 同樣檢查兩種字元，可在實際 Auth 服務的環境設定加入 `GOTRUE_PASSWORD_REQUIRED_CHARACTERS=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789`。需先檢查 Compose 的對應，不能只在 Coolify 新增未使用的變數。此次未代為更改 Auth 服務端密碼政策。[Auth 官方設定說明](https://github.com/supabase/auth#configuration)

採使用者指定的人工審核模式，不要求收註冊驗證信。Auth 在註冊時自動完成自己的確認狀態，NROP 成員仍為 pending，讀寫權限必須由管理者啟用。前端會先查公開 Auth 設定；若尚未啟用自動確認，直接停止註冊，不送出 signUp。既有舊版未確認的帳號，可在開啟自動確認後用原 Email 及原密碼重新申請；不會把重新申請輸入的新密碼當作重設密碼。

## 4. 啟動網站與首位系統管理者

在專案終端機執行：

```powershell
npm ci
npm run dev
```

1. 開啟終端機提供的本機網址，選「申請帳號」，輸入姓名、單位、自己的 Email 和密碼。
2. 送出後直接看到「待審核」，等候系統管理者核准；不需收取註冊驗證信。
3. 開啟 `supabase/003_bootstrap_admin.sql`，只將 `target_email` 的示範地址改成自己的 Email。
4. 在 SQL Editor 執行這份檔案。重新登入或按「重新檢查核准狀態」，應看到系統管理者及「帳號管理」頁籤。
5. 其他人申請後，在「帳號管理」將狀態設為啟用、指定角色及單位，按儲存。平台使用者必須指定單位。

初始化腳本只允許在沒有啟用系統管理者時執行。後續管理者由既有系統管理者授權；最後一位啟用的系統管理者不能停用或降權。系統管理者無法查看別人的密碼，忘記密碼由使用者透過 Email 重設。

## 5. 檢查 DEMO 與正式填報

登入後預設正式區，目前沒有正式資料。切換「資料區 → DEMO 測試資料」即可看 2026-10-25 的範例，也可選更早的日期。DEMO 含原本的未送出、缺人力等異常，舊紀錄未分科／未分人力職類者保留合計，待人工分類。

正式啟用住院單位時，由一般管理者或系統管理者選定單位、首日與首班，在「期初住院人數」填入已核對的前班人數；即使為 0 也要明確設定。其後 N→D→E 延續計算。一般使用者可暫存；前班未完成時正式送出會先改為暫存。特殊營運單位無須住院期初基準。

建議先用兩個測試帳號驗收：A 屬於 7A、B 屬於 7B。確認 A 無法讀寫 7B；再由系統管理者停用 A，保持 A 原分頁登入狀態後重整／送出，應立即被拒絕。測試資料放在 DEMO 區。舊 localStorage 中的人工資料未自動搬移，先另行備份與核對，避免與範例混入正式區。

## 6. 之後才部署 Coolify 網站

目前沒有代為推送或部署。要上線時，先把程式提交到 GitHub，再由你在現有 NROP 應用選 Dockerfile 建置，容器埠 80；兩個公開設定必須提供為 Build Arguments。金鑰名稱沿用 `.env.local` 的 NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_ANON_KEY。

`.env.local` 不會進 Git 或 Docker build context。Coolify 不能靠讀取你筆電的檔案取得設定；網頁建置時必須另外填入公開設定，修改後需重建。勿將 service_role、secret key 或資料庫連線密碼放進任何 NEXT_PUBLIC_* / VITE_*。

Dockerfile 已準備，但本機未安裝 Docker，因此尚未實際建置／啟動容器。正式使用前需驗證部署後的登入、寄信、兩台電腦同筆資料、備份與還原。
