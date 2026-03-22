# Frontend (React + Vite + Capacitor Android)

## 1) Web 开发
```bash
cd frontend
npm install
npm run dev
```
默认地址：`http://127.0.0.1:5173`

## 2) Android 初始化（首次）
```bash
cd frontend
npm run build
npm run android:init
npm run android:sync
```

## 3) 生成 APK（debug）
```bash
cd frontend
npm run build
npm run android:sync
npm run android:apk
```
产物路径：
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`

## 4) 打开 Android Studio（可选）
```bash
cd frontend
npm run android:open
```
