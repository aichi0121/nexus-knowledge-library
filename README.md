# Nexus 個人跨領域知識庫

這是一個給個人使用的跨領域學習知識庫：集中管理課程、逐字稿、筆記、學習進度與 Obsidian 同步資料。

## 目前功能

- 以課程為中心的學習首頁、課程詳情與筆記介面。
- 已匯入「193｜（墨夏班）AI影片創作 0-1 實戰營」的課程架構與處理紀錄。
- Firebase Google 登入與使用者資料建立。
- Firebase Firestore 連線設定。
- 可部署到靜態網站環境。

## 本機啟動

先安裝相依套件，再啟動開發網站：

```bash
npm install
npm run dev
```

完成後，在瀏覽器開啟終端機顯示的本機網址（通常是 `http://127.0.0.1:5173/`）。

## 上線前檢查

```bash
npm run build
npm run test:sites
```

## Firebase 設定

專案已使用 Firebase Authentication（Google）與 Firestore。若換成新的正式網站網址，請在 Firebase Console 的：

`Authentication → Settings → Authorized domains`

加入該網站的網域，才能讓 Google 登入在正式網站運作。

## 隱私提醒

目前課程畫面中的示範資料仍放在前端程式碼中，因此只要網站被公開發布，任何人都可以看到這些已內建的內容；Google 登入按鈕本身不會自動把整個網站鎖起來。

真正的私人知識內容應改存於 Firestore，並由登入後的帳號與 Firestore 規則控制讀取權限。下一步建議是將現有靜態課程資料搬入 Firestore，並在未登入時顯示登入頁。

## 專案結構

- `src/App.jsx`：網站頁面與互動。
- `src/firebase.js`：Firebase 連線設定。
- `src/styles.css`：視覺樣式。
- `public/`：字體與圖片資產。
- `worker/`、`scripts/`、`tests/`：部署打包與驗證所需檔案。

## 原始資料

課程影片、字幕與 Obsidian 筆記保留在本機 Nexus 工作資料夾；此網站專案只存放網站程式與必要的展示內容，不會自動上傳原始影片。
