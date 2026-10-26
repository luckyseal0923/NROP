# 護理即時動態平台 NROP

班別填報、床位動態、人力與特殊單位統計。此版本已從任意密碼的本機展示改為 Supabase Auth 與共享資料庫。

## 目前進度（2026-10-26）

- **已驗證**：本機程式、單一資料區、三種角色、帳號申請與管理、資料庫驗證與班別重算；30 項自動化測試與正式版建置通過。
- **已驗證**：本機 PostgreSQL 引擎（PGlite）可執行完整安裝 SQL，匯入 7,224 筆 DEMO，與舊前端快照一致；範例與後續填報放在同一資料區。
- **已驗證**：`.env.local` 已排除 Git，僅讀取公開 Supabase 網址與 anon key，未輸出金鑰。
- **已驗證（後續連線檢查）**：Auth 與 NROP 設定 API 已回應 HTTP 200，讀到 28 單位、DEMO 最後日期 2026-10-25，申請已開放。使用者 SQL Editor 截圖顯示安裝後有 7,224 筆 DEMO。先前的 503／資料庫名稱錯誤已不再阻擋這兩個 API。
- **帳號與網站狀態**：指定首位系統管理者已啟用並確認；先前唯讀檢查發現 Coolify 的 NROP 環境變數空白。公開建置變數由使用者補入後需 Redeploy，正式網站登入、寄信與跨電腦共用仍待驗收。
- **已驗證（經使用者明確同意）**：已將測試 Supabase 的 ENABLE_EMAIL_AUTOCONFIRM 設為 true 並重啟；Auth API HTTP 200，mailer_autoconfirm=true。SMTP 由使用者本人操作，已回報填寫完成並重啟，實際寄信與返回網址內容仍待驗證。
- **GitHub 同步與部署**：已推送的帳號版本為 7e98c6e；本次依使用者要求同步單一資料區及登入主視覺修改，實際提交以遠端 main 為準。尚未由代理調整 Coolify 建置或完成網站部署驗收。使用者回報已執行 UPGRADE_005_007.sql；本次唯讀 API 檢查確認 dataArea=shared、28 單位、最近紀錄 2026-10-25。

登入左側主視覺維持原圖 3:4 比例，完整等比顯示；右側登入或申請表單增高時，圖像及 NROP 字樣不再縮放裁切。詳見 [完整修改對照](docs/登入主視覺固定比例_修改對照.md)。

## 帳號與權限

| 角色 | 功能 |
| --- | --- |
| 平台使用者 | 僅讀寫核准單位的填報資料 |
| 一般管理者 | 全院儀表板、選擇各單位填報、設定首次啟用的期初住院人數 |
| 系統管理者 | 一般管理者功能、帳號審核／啟用／停用、角色與單位指定、申請開關、操作紀錄 |

登入採 Email＋密碼。流程為「申請 → 待審核 → 系統管理者核准啟用」，註冊不要求收驗證信。Supabase Auth 負責密碼驗證；NROP 不儲存明碼、不提供查看他人密碼的功能。預設申請角色固定為平台使用者、狀態待審核；登入頁沒有角色選單。網頁的密碼規則為至少 6 碼並包含英文與數字，Auth 服務端也需依安裝指南設定密碼政策。

申請單位包含護理部及原有 28 個填報單位。護理部是行政申請單位，由系統管理者核准適當角色；不增加床數或班別填報。

**已安裝環境**：先備份並暫停填報，在 SQL Editor 執行 [UPGRADE_005_007.sql](supabase/UPGRADE_005_007.sql)，再部署本次網站程式。包含護理部、人工審核及單一資料區整併；不需重跑 INSTALL，遇到重複紀錄／期初衝突會停止而不覆蓋。請依 [單一資料區更新指南](docs/單一資料區_更新指南.md) 操作。註冊仍使用 `ENABLE_EMAIL_AUTOCONFIRM=true`，NROP 資格由管理者核准。

權限由每次資料庫 RPC 檢查，即使已持有登入憑證，停用的 NROP 成員也不能讀寫。成員資格屬於 NROP，不會停用共用 Auth 中的其他平台帳號；但變更共用 Auth 密碼會影響其他使用同一身分的系統。

## 先安裝資料庫

完整步驟見 [Supabase 與帳號系統安裝指南](docs/Supabase與帳號系統_安裝指南.md)。

1. 在新測試 Supabase 的 SQL Editor 貼上整份 [INSTALL.sql](supabase/INSTALL.sql)，執行一次。內容包含結構、權限、28 單位設定、2026-08-01～2026-10-25 的 DEMO。
2. 依指南啟用 Auth 的自動確認 Email，啟動網站並申請自己的帳號；送出後等候 NROP 管理者核准。
3. 將 [003_bootstrap_admin.sql](supabase/003_bootstrap_admin.sql) 的 Email 換成自己的，貼入 SQL Editor 執行。只初始化第一位系統管理者，不包含任何密碼。
4. 登入後用「帳號管理」核准其餘申請。也可執行 [004_verify_install.sql](supabase/004_verify_install.sql) 核對安裝結果。

`INSTALL.sql` 整份在單一交易內；失敗時回滾。重跑已安裝的結構會拒絕建立同名 schema，不會自動刪除或重建資料。`002_demo_seed.sql` 可獨立重跑，遇到已存在的 DEMO 不覆蓋。

## 本機啟動

使用 Node.js 22 LTS（本機已在 Node 20.20 驗證；伺服器 Dockerfile 使用 22）。

```powershell
npm ci
npm run dev
```

開啟終端機顯示的 `http://127.0.0.1:5173`。此版本需要啟動網站服務，不能再直接雙擊 `index.html`。

專案根目錄 `.env.local` 使用既有名稱：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase.example.org
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

也接受 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`。只有公開網址與公開 key 會被編入網頁；禁止使用 service_role / secret key / 資料庫密碼。Vite 設定會拒絕 service_role JWT 與 secret key。

```powershell
npm run db:check
npm test
npm run build
```

`db:check` 僅檢查 Auth 與 NROP 設定 API，不輸出 key、不建立使用者或修改資料。

## 資料儲存與 DEMO

- `nrop.units`：有效床數、單位類別、允許填報欄位。
- `nrop.application_units`：護理部及各填報單位的申請選項，共 29 個。
- `nrop.members`：帳號角色、核准單位、啟用狀態；密碼不在此表。
- `nrop.records`：日期／班別／單位／資料區的唯一紀錄，含版本及更新者。所有紀錄共用一個資料區；相同日期、班別、單位只有一筆。`is_sample` 僅保留匯入來源，供正式啟用前盤點，不影響顯示、儲存、統計或權限。
- `nrop.opening_balances`：第一班的期初人數。
- `nrop.settings`：是否開放申請及統計起始日期。
- `nrop.audit_log`：帳號、設定、填報與後續重算的操作紀錄。

資料表放在未公開的 `nrop` schema，全部啟用 RLS 並取消瀏覽器直接讀寫權限；預設拒絕。僅公開必要的 `public.nrop_*` RPC，以固定搜尋路徑、明確角色及單位檢查執行。**不需將 `nrop` 加入 Exposed schemas**，也不需前端 service_role。

畫面直接查詢同一份資料，沒有正式／DEMO 選單；可選 2026-08-01～2026-10-25 查看原範例，新增及修改也在同一處。登入仍預設今天，不會每天由瀏覽器產生範例數字。舊 DEMO 尚無本科／隔離或護理師／護佐分類者保留原合計並要求補分類，不推測拆分。

資料快取只在記憶體中。登入憑證保存在本分頁的 sessionStorage，營運紀錄不再寫入 localStorage。舊瀏覽器 `nursing-daily-records` 仍留在原處，**未刪除、未自動上傳**；其中若有人工作業資料，需另外備份、辨識及核對後再規劃匯入，不能將所有舊資料當成正式資料。

當班人數、分類住院合計、護理之家人力在資料庫重算。修改前班時依 N→D→E 順序更新連續的後續班別，遇缺班就停止；不以字母排序猜班別。版本衝突會拒絕覆寫，避免不同電腦互相蓋掉。後續已有正式紀錄時，不允許把其前班改回暫存。

正式啟用前先備份並執行 [範例盤點 SQL](supabase/008_sample_inventory.sql)。本次保留範例，清除步驟待確認保留資料與首班期初人數後執行；帳號與單位設定可保留。

## Coolify

已提供 Dockerfile 與 nginx.conf，供使用者自行部署。選 Dockerfile 建置，設定容器埠 80；將兩個公開設定設為 Build Variables／Build Arguments。編譯後設定固定，改值需重新建置。現有 Coolify 已使用 Railpack 提供網站時，可先保留此建置方式，在 NROP 應用補上兩個公開變數並標記 Available during build，再 Redeploy；不必只為補變數而切換建置方式。

## 驗證範圍

詳見 [2026-10-26 驗證紀錄](docs/驗證紀錄_2026-10-26.md)。SQL 測試模擬 Supabase 的 Auth 身分，使用真實 PostgreSQL 引擎執行；表單測試使用 JSDOM 與受控 API。它們沒有代替實際自架 Supabase、SMTP、真實瀏覽器或 Docker 的驗收。

[完整修改前後對照](docs/帳號權限與Supabase_修改對照.md) 提供原完整首頁與修改後各檔案。

本次單一資料區的 [完整修改前後對照](docs/單一資料區_修改前後對照.md) 包含可直接複製的完整對應檔案。
