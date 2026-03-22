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

## 5) 运行模式（已支持 APK 内前后端一体）
- **Android APK 内默认启用本地后端模式（local backend）**：
  - 不依赖外部 FastAPI 进程
  - 紧急配置与 SOS 事件存储在本地 `localStorage`
  - SOS 通知结果为本地模拟日志 + 原生拨号/短信拉起
- **Web 开发模式默认走远端 FastAPI**：`http://127.0.0.1:8000/api/v1`
- 可通过浏览器手动开启本地后端（调试用）：
  ```js
  localStorage.setItem('safety_force_local_backend', '1')
  ```

## 6) 本地后端接口覆盖范围
APK 本地后端已覆盖 MVP API：
- `GET /health`
- `GET/POST /emergency/config`
- `POST /sos/events`
- `POST /tracking/points`
- `GET /tracking/timeline`
- `GET/POST /contacts`

说明：
- 数据存储在本地 `localStorage`（key: `safety_local_backend_v1`）
- `tracking/timeline` 同样校验时间范围（`from <= to`）
- `contacts` 支持按 `userId` 读写

## 7) 真机行为说明
- 在 Android App 内点击“触发 SOS”时会：
  1. 调用 APK 内本地后端记录 SOS 与通知日志
  2. 尝试打开系统拨号（`tel:`）
  3. 尝试打开系统短信（`sms:`）并填充模板内容
- 若号码留空，会自动跳过对应动作

## 8) 打开 Android Studio（可选）
```bash
cd frontend
npm run android:open
```
