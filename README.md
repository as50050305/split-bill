# 分帳本 Split Bill

和朋友出遊用的分帳 Android App。React + Vite + TypeScript，用 Capacitor 打包成 APK。
資料全部存在手機本機，不需要網路、不需要登入。

---

## 一、安裝到手機

1. 打開 GitHub 專案頁 → 右側 **Releases** → 點最新版本 → 下載 `split-bill-v1.0.x.apk`
   （用手機瀏覽器開最方便；也可以在電腦下載後用 LINE / USB 傳到手機）
2. 在手機點下載好的 APK
3. 第一次會跳出「基於安全考量，您的手機目前不允許安裝這個來源的不明應用程式」
   → 點 **設定** → 開啟 **允許這個來源**（Chrome、檔案管理員或 LINE，看你從哪裡開）→ 返回
4. 點 **安裝** → 完成。桌面會出現「分帳本」

> Google Play 保護機制可能提示「未知的應用程式」，選 **仍要安裝** 即可（這是自己打包、未上架的 App 的正常現象）。

### 更新到新版

直接下載新版 APK 安裝、覆蓋舊版即可，**資料會保留**。
（每次雲端打包都用同一個簽章，版本號自動遞增，所以可以直接覆蓋。）

> ⚠️ 不要先解除安裝舊版，解除安裝會清掉手機裡的帳本資料。

---

## 二、怎麼修改

### 開發環境

需要 Node.js 22 以上。

```bash
npm install
npm run dev        # 瀏覽器預覽（http://localhost:5173），改程式碼會即時更新
npm test           # 跑計算邏輯的自動化測試
```

瀏覽器預覽時把 Chrome 開發者工具切到手機尺寸（例如 iPhone 12 Pro）最接近實際畫面。
瀏覽器預覽的資料存在瀏覽器的 localStorage，跟手機上的資料互不相通。

### 程式在哪裡

| 想改的東西 | 檔案 |
|---|---|
| 分帳計算規則（平分、份數、零頭、結算） | `src/core/` （純函式，有測試） |
| 支出分類 | `src/core/categories.ts` |
| 顏色、字級、按鈕大小 | `src/index.css` 最上面的 `:root` 變數 |
| 各頁畫面 | `src/pages/` |
| 共用元件（金額輸入、對話框…） | `src/components/ui.tsx` |
| 結算圖片的樣式 | `src/share/settlementImage.ts` |
| 資料儲存方式 | `src/data/` |
| App 名稱、套件名稱 | `capacitor.config.ts` |
| App 圖示、啟動畫面 | `resources/` 換圖後執行 `npx capacitor-assets generate --android --assetPath resources` |

### 修改計算規則時

先改 `src/core/__tests__/` 裡的測試，再改 `src/core/`，跑 `npm test` 全部通過再提交。
需求文件的 5 個驗證案例在 `acceptance.test.ts`，雲端打包前會自動跑，**測試沒過就不會產出 APK**。

### 改了資料結構時

1. `src/data/repository.ts` 的 `SCHEMA_VERSION` + 1
2. 在 `src/data/migrations.ts` 加一個升級步驟，把舊格式轉成新格式

這樣使用者更新 App 後，舊資料會自動升級，不會壞掉。

---

## 三、重新打包 APK

### 方法 A：GitHub Actions（推薦，電腦不用裝 Android 工具）

把修改推到 GitHub 的 `main` 分支就會自動打包：

```bash
git add .
git commit -m "說明這次改了什麼"
git push
```

約 5–8 分鐘後，在 GitHub 專案的 **Actions** 分頁看到綠色勾勾，**Releases** 就會出現新版 APK。
也可以在 Actions → Build APK → **Run workflow** 手動觸發。

打包流程在 `.github/workflows/build-apk.yml`：安裝套件 → 跑測試 → 建置網頁 → 同步到 Android → Gradle 打包 → 發佈。

### 方法 B：在自己電腦打包

需要先安裝 [Android Studio](https://developer.android.com/studio)（內含 Android SDK）和 JDK 21。

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleRelease          # Windows 用 gradlew.bat assembleRelease
```

APK 會在 `android/app/build/outputs/apk/release/app-release.apk`。
也可以 `npx cap open android` 用 Android Studio 開啟，接上手機直接按 ▶ 執行。

### 瀏覽器單檔預覽版

```bash
npm run preview:single   # 產出 dist-preview/，內含範例資料
```

---

## 四、技術說明

- **金額**：一律用整數（元）運算，不用浮點數。份數最多兩位小數，內部放大 100 倍成整數計算。
- **平均分攤零頭**：多出的 1 元依旅程成員順序給前面的人（建立旅程時可用 ↑ 調整順序）。
- **份數分攤零頭**：最大餘數法，小數部分最大的人先拿，相同時依成員順序。
- **模式二結算**：貪婪法，最大債權人配對最大債務人；金額相同時依成員順序。
- **模式一結算**：每人「投入（含代墊）− 應分攤」，正數由保管人退回、負數補給保管人。保管人手上的公費餘額會從他的部位扣除。
- **代墊**：模式一的支出可標成某人自掏腰包，視為他投入同額公費再由公費支出。
- **已還款**：存成實際的付款紀錄。之後再加支出，結算會自動只算剩下的差額。
- **簽章**：`android/app/splitbill.keystore` 是自用側載簽章（密碼寫在 `android/app/build.gradle`）。
  建議 GitHub repo 設為 **Private**。若要上架 Google Play，請另外產生正式簽章，改用 GitHub Secrets 傳入，不要把正式簽章放進 repo。

## 五、第二版預留的擴充點

| 功能 | 預留方式 |
|---|---|
| 多幣別 | `Trip.currency` 欄位已存在；金額是「最小貨幣單位整數」 |
| 雲端備份／多人同步 | UI 只依賴 `Repository` 介面，新增一個實作即可；所有資料變更都是 `src/store/actions.ts` 的純函式，方便轉成同步事件 |
| SQLite | 同上，實作 `Repository` |
| 收據拍照 | `Expense` 可加 `attachments` 欄位，搭配 migration |
| 自訂分類 | `categories.ts` 改成存在資料庫的預設值 |
