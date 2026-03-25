# Frontend (React + Vite + Capacitor Android)

## 1) Web 开发
```bash
cd frontend
npm install
npm run dev
```
默认地址：`http://127.0.0.1:5173`

## 1.1) 基础测试
```bash
cd frontend
npm test
```

当前已覆盖的基础前端逻辑测试包括：
- 短信模板默认值回退
- 短信模板占位符校验
- 短信模板渲染

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

### 4.1) 迭代开发打包约定
每次前端功能迭代完成后，默认执行以下验收与打包流程：
```bash
cd frontend
npm run build
npm run android:sync
npm run android:apk
npm run android:release
```

说明：
- `android:apk` 生成 debug APK，便于开发联调与真机快速安装
- `android:release` 会自动执行 release APK + release AAB 构建
- 上面的默认流程以 `npm run android:release` 收尾，release APK / AAB 属于每次前端功能迭代完成后的默认打包验收范围，不是可省略的附加步骤
- release 构建依赖签名文件：
  - `/home/crp/.solo-youth-safety/signing/release-signing.properties`
  - `/home/crp/.solo-youth-safety/signing/solo-youth-safety-release.jks`
- 若签名配置路径有变，可设置环境变量：`SAFETY_SIGNING_PROPERTIES_FILE`
- 每次功能迭代完成后，除代码与打包外，也要同步更新相关开发文档（至少包括本 README；如涉及能力边界、路线图、接口或验收方式变化，还需同步更新对应 `docs/` 文档）
- 若是预发 / 生产打包，还必须同步检查 `VITE_API_BASE_URL` 是否已指向目标环境后端，避免将回环地址打进产物

版本约定：
- 当前前端 / Android 产物版本基线为 `0.3.0`（以 `frontend/package.json` 为准）
- 应优先修改 `frontend/package.json` 中的版本号
- 每次常规迭代至少递增补丁位（patch）
- Vite 注入的 `__APP_VERSION__`、Android `versionName` 以及 APK/AAB 文件名都会同步使用该版本号
- 后端 OpenAPI / 文档版本当前仍以 `backend/main.py` 为准，现状默认值为 `0.2.1`，与前端产物版本未完全统一；差异说明见 `../docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`
- `SAFETY_APP_VERSION` 目前不是后端现状能力，因此不要把它当作可用的版本覆盖入口

常用产物路径：
- Debug APK：`frontend/android/app/build/outputs/apk/debug/solo-youth-safety-v<version>-debug.apk`
- Release APK：`frontend/android/app/build/outputs/apk/release/solo-youth-safety-v<version>-release.apk`
- Release AAB：`frontend/android/app/build/outputs/bundle/release/solo-youth-safety-v<version>-release.aab`

## 5) 首次启动引导、主题与页面结构（已实现）
- App 首次打开会自动申请定位权限
- 权限申请后自动进入“通知配置”页面引导
- 当前 UI 已拆分为分页面结构：
  - 总览
  - 守护
  - 主题
  - 通知配置
  - 联系人
  - SOS
  - 历史
  - 工具（本地后端 / 自检，默认隐藏在开发者模式下）
- 页面导航支持：
  - 顶部页面跳转条可直接切换总览 / 守护 / 配置 / 联系人 / SOS / 历史
  - 左上角菜单按钮呼出/收起侧边栏
  - 页面空白处从左向右滑动呼出侧边栏
  - 侧边栏打开后可左滑收起，支持跟手拖拽
  - 切换页面时会自动回到顶部，减少“长页”感
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
  - 2~3 次多次采样并自动采用精度最佳结果
  - Android 端定位采用双通道策略：优先 `@capacitor/geolocation`（GMS / fused），失败时自动回退到系统 `LocationManager`
  - 位置新鲜度提示
  - 定位精度分级提示（很准 / 良好 / 一般 / 较弱）
  - 最近刷新时间展示
  - SOS 倒计时结束前自动尝试刷新旧位置 / 缺失位置
- “守护”页已支持“轨迹守护”：
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
  - SOS 通知结果为本地模拟日志 + 原生直接短信 / 直接拨号执行结果
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
  1. 若当前位置缺失或已偏旧，先尝试进行 2~3 次采样刷新，并采用精度最佳结果
  2. Android 端优先尝试 GMS fused 定位；若设备缺少 GMS、fused 返回不可用或超时，则自动回退到系统 `LocationManager`
  3. 调用 APK 内本地后端记录 SOS 与通知日志
  4. 首次需要时申请 `SEND_SMS` / `CALL_PHONE` 权限
  5. 先使用 `SmsManager` 直接发送短信，再使用 `ACTION_CALL` 直接发起拨号
- 若号码留空，会自动跳过对应动作
- 若用户拒绝相关权限，App 会保留 SOS 上报结果，并在“最新操作结果”中明确显示对应失败原因
- 若系统仅授予“大致位置”，App 会自动降级为粗定位采样，并在提示文案中说明
- 若系统定位服务关闭、设备缺少 GMS 或双通道都失败，App 会在“最新操作结果”中展示更明确的失败原因
- 若倒计时结束后仍无法获取当前位置，则会取消本次 SOS 上报并提示先刷新位置
- SOS 事件详情已独立到“历史”页面，可查看最近事件的时间、位置、通知结果

## 9) 打开 Android Studio（可选）
```bash
cd frontend
npm run android:open
```
