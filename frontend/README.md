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

## 4) 首次启动引导（已实现）
- App 首次打开会自动申请定位权限
- 权限申请后自动进入“紧急通知配置”引导
- 配置项支持：
  - 电话号码（可留空）
  - 短信号码（可留空）
  - 短信模板（自定义）

## 5) 真机行为说明
- 在 Android App 内点击“触发 SOS”时会：
  1. 上报后端 SOS（服务端模拟通知）
  2. 尝试打开系统拨号（`tel:`）
  3. 尝试打开系统短信（`sms:`）并填充模板内容
- 若号码留空，会自动跳过对应动作

## 6) 打开 Android Studio（可选）
```bash
cd frontend
npm run android:open
```
