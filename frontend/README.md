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
产物路径（按版本号命名）：
`frontend/android/app/build/outputs/apk/debug/solo-youth-safety-v<version>-debug.apk`

## 4) 生成 release APK / AAB（已支持）
首次生成项目外签名资产：
```bash
cd frontend
npm run android:release:setup-signing
```

生成 release APK + AAB：
```bash
cd frontend
npm run android:release
```

也可分别生成：
```bash
cd frontend
npm run android:apk:release
npm run android:aab:release
```

产物路径：
- `frontend/android/app/build/outputs/apk/release/solo-youth-safety-v<version>-release.apk`
- `frontend/android/app/build/outputs/bundle/release/solo-youth-safety-v<version>-release.aab`

默认签名资产位置（均在项目外）：
- 主目录：`/home/crp/.solo-youth-safety/signing`
- 备份目录：`/home/crp/Desktop/solo-youth-safety-signing-backup`
- 可通过环境变量覆盖：`SAFETY_SIGNING_PROPERTIES_FILE`

## 5) 首次启动引导、主题与页面结构（已实现）
- App 首次打开会自动申请定位权限
- 权限申请后自动进入“通知配置”页面引导
- 当前 UI 已拆分为抽屉侧边栏多页面：
  - 总览
  - 主题
  - 通知配置
  - 联系人
  - SOS
  - 历史
  - 工具（本地后端 / 自检，默认隐藏在开发者模式下）
- 页面导航支持：
  - 左上角菜单按钮呼出/收起侧边栏
  - 页面空白处从左向右滑动呼出侧边栏
  - 侧边栏打开后可左滑收起，支持跟手拖拽
  - 当前主页面主体宽度保持在约 80%~90% 屏宽
- 主题页已支持：
  - Android 12+ 默认壁纸吸色（Material You）
  - 预设调色板
  - 自定义调色板
  - 主题选择持久化保存
- 配置项支持：
  - 电话号码（可留空）
  - 短信号码（可留空）
  - 短信模板（自定义）
  - 持久化 userId / deviceId 展示
- 总览页与 SOS 页已支持：
  - 手动刷新当前位置
  - 位置新鲜度提示
  - 最近刷新时间展示
  - SOS 倒计时结束前自动尝试刷新旧位置 / 缺失位置
- 总览页已支持“轨迹守护”：
  - 可开启 / 停止周期轨迹写入
  - 可配置自动采样周期（30 / 60 / 180 / 300 秒）
  - 可立即手动采样并触发补发
  - 弱网或写入失败时会进入本地待补发队列
  - App 回到前台、网络恢复后会自动继续补发
- 联系人已独立为单独页面，支持：
  - 新增联系人
  - 编辑联系人
  - 删除联系人
  - 一键将联系人号码填入电话 / 短信字段

## 6) 运行模式（已支持 APK 内前后端一体）
- **Android APK 内默认启用本地后端模式（local backend）**：
  - 不依赖外部 FastAPI 进程
  - 紧急配置、主题、身份、本地后端数据已升级为 **Capacitor Preferences** 持久化
  - SOS 通知结果为本地模拟日志 + 原生拨号/短信拉起
- **Web 开发模式默认走远端 FastAPI + SQLite**：`http://127.0.0.1:8000/api/v1`
- 可通过浏览器手动开启本地后端（调试用）：
  ```js
  localStorage.setItem('safety_force_local_backend', '1')
  ```

## 7) 本地后端接口覆盖范围
APK 本地后端已覆盖 MVP API：
- `GET /health`
- `GET/POST /emergency/config`
- `POST /sos/events`
- `GET /sos/events`
- `POST /tracking/points`
- `GET /tracking/timeline`
- `GET/POST /contacts`
- `PUT/DELETE /contacts/{contactId}`

说明：
- Android 端数据优先存储在 **Capacitor Preferences**（key 如 `safety_local_backend_v1`、`safety_tracking_state_v1`）
- Web 端仍使用 `localStorage` 作为浏览器开发存储
- `tracking/timeline` 同样校验时间范围（`from <= to`）
- `contacts` 支持按 `userId` 读写
- App 内已将“本地后端数据面板”收纳到“工具”页面，默认需连续点击版本号 5 次开启开发者模式后显示
- 工具页可查看配置/SOS/联系人/轨迹点计数并支持清空当前用户本地数据
- 工具页内提供真机自测按钮：导出本地快照、导入本地快照、添加模拟联系人、写入模拟轨迹、刷新联系人快照、刷新最近 1 小时轨迹
- 联系人 / 轨迹快照会在工具页内以列表卡片展示，便于直接验收 contacts / tracking 数据
- 本地快照会导出当前用户的配置、联系人、轨迹点、SOS 事件与汇总信息
- 导入本地快照时会先提示覆盖确认，然后按快照内 `userId` 恢复该用户的数据

## 8) 真机行为说明
- 在 Android App 内点击“触发 SOS”时会：
  1. 若当前位置缺失或已偏旧，先尝试刷新当前位置
  2. 调用 APK 内本地后端记录 SOS 与通知日志
  3. 尝试打开系统拨号（`tel:`）
  4. 尝试打开系统短信（`sms:`）并填充模板内容
- 若号码留空，会自动跳过对应动作
- 若倒计时结束后仍无法获取当前位置，则会取消本次 SOS 上报并提示先刷新位置
- SOS 事件详情已独立到“历史”页面，可查看最近事件的时间、位置、通知结果

## 9) 打开 Android Studio（可选）
```bash
cd frontend
npm run android:open
```
