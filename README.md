# 独行青年安全守护应用：统一项目文档

更新时间：2026-06-02

> **单一事实来源**：本文件统一承担项目现状、能力边界、运行构建、测试验证、路线图、任务清单、审查结论和文档治理职责。其他 README、API 文档、历史计划和审查页只作为专项参考或历史归档，不再单独维护一套项目状态。

## 1. 项目定位

本项目面向独行青年的人身安全场景，当前形态是：

- Android MVP 演示底座：React + Vite 前端通过 Capacitor 打包为 Android App。
- 前端主线：TypeScript + MUI + Zustand，本地持久化为主。
- 后端状态：FastAPI + SQLite 代码与 API 文档仅作为历史归档；后续路线默认不再继续后端联调或远端化收口。
- 当前目标：先把 Android MVP 变成可信试用底座，再选择性向原始愿景中的地图回放、规则引擎、风险提示等能力靠拢。

当前项目**不是**完整守护平台、正式应急平台、正式账号体系、远端联调平台或生产级安全后端。

## 2. 当前统一事实

| 项 | 当前事实 | 依据 |
| 前端入口 | `frontend/src/main.tsx` -> `frontend/src/App.tsx` | 当前 Vite 入口 |
| 前端 / Android 版本 | `0.4.28` | `frontend/package.json` |
| 本地快照导出版本 | 跟随 `frontend/package.json` 输出当前版本 | `frontend/src/data/snapshot.ts` |
| package-lock 版本元数据 | 已收口为 `0.4.28` | `frontend/package-lock.json` |
| 前端运行模式 | TS 入口以本地持久化为主 | 当前 TS 源码无远端 API 调用 |
| 后端 / API | 预计弃用；代码与 API 文档仅历史归档 | `backend/`、`docs/api/README.md` 不再作为当前路线 |
| Android 壳 | Capacitor 6，debug / release APK 与 release AAB 构建链路保留 | `frontend/android/` / 构建脚本 |
| Android Manifest | 声明网络、前台定位、电话、短信、电池优化设置入口、旧版外部存储权限；未声明后台定位、前台服务、开机恢复、唤醒锁 | `frontend/android/app/src/main/AndroidManifest.xml` |
| 原生桥 | Java 插件已注册，TS 已回接 `EmergencyActions` / `SystemLocationBridge` / `StartupPermissions`；Android 原生定位优先走系统 `LocationManager`，TS 校验坐标有效性，先尝试系统低精度 / 缓存快速定位，异常或非法坐标时再升级 GPS 高精度，不再把 Google-backed Capacitor Geolocation 作为 Android fallback；首次配置页可申请定位权限、打开后台运行/省电设置、检查旧版存储访问；Web 仍使用 Capacitor Geolocation | `frontend/src/native/nativeActions.ts` / `frontend/src/native/nativeLocation.ts` / `frontend/src/native/permissions.ts` |

## 3. 不可突破的能力边界

当前对外只能承诺：

> **前台 / 应用存活期间的手动 SOS + 应用存活期间周期采样 + 本地队列 / 本地确认能力**

必须明确：

- 周期采样仅限应用存活期间；本轮真机运行正常无问题，但后台、熄屏、被杀或 force-stop 后持续运行仍不得外推为长时保活能力。
- “待处理队列 / 本地确认”只是本地语义；后端弃用后，真实同步目标和失败重试语义需要重新定义。
- Android 原生短信 / 电话桥已完成 TS 回接，并已完成本轮 Android 真机验收。
- Android 自定义定位桥已完成 TS 回接，并已完成本轮 Android 真机验收。

禁止对外承诺：

- Android 长时后台保活。
- 被系统杀死、force-stop、最近任务划掉后仍持续追踪。
- 当前版本已具备长期前台服务方案或稳定常驻通知机制。
- 自动报警、围栏、异常检测、规则引擎已经完成。
- 正式应急平台、完整账号体系、生产级隐私合规闭环已经完成。
- 实时地图监护已经完成。地图化历史回放（本地，无实时地图监护）MVP 已交付：本地轨迹历史回放 + SOS 坐标回放页。
- 当前仍保留远端后端联调或生产 API 路线。

## 4. 当前已落地能力

### 4.1 前端 / Android


### 4.0 代码分层架构

| 层 | 目录 | 职责 | 依赖方向 |
| --- | --- | --- | --- |
| DOM / 入口 | `main.jsx`, `App.tsx`, `providers/` | React 渲染入口，全局 Provider 挂载，路由分发 | ↓ pages/shell |
| 页面 | `pages/` | 单页组件，组合 UI 与数据，不直接操作 native/持久化 | ↓ stores/hooks/components |
| 外壳 | `shell/` | 布局（AppBar/Drawer/导航），纯 UI 编排 | ↓ stores |
| 组件 | `components/` | 跨页复用 UI 片段（状态栈/错误边界/确认弹窗/空态） | 无依赖 |
| Ho ok | `hooks/` | 纯 React hooks（路由/倒计时/位置新鲜度），不直接操作 native/持久化 | ↓ stores |
| 状态 | `stores/` | Zustand store，业务状态与副作用编排；不直接调 native，只通过 data 层 | ↓ data/domain |
| 数据 | `data/` | 持久化封装（repo 文件 + storage 抽象），native 桥接转发（sosActions/locationProvider） | ↓ native(通过转发) |
| 领域 | `domain/` | 纯函数，零 IO，无外部依赖（类型/模板/队列/状态计算/回放） | 无依赖 |
| 原生 | `native/` | Capacitor 插件封装（短信/电话/定位/权限），仅被 data 层调用 | ↓ @capacitor/* |

关键约定：
- 页面不直接 import native/，不直接操作持久化（工具页除外，因其本身就是开发者工具入口）。
- Store 通过 data 层的 repo 文件读写持久化，不直接 import storage.ts。
- Store 通过 data 层转发文件调用 native 能力，不直接 import native 模块。
- domain 层零 IO、零外部依赖，仅纯函数。
- 旧版 .js 文件已全部删除；当前入口统一为 `main.tsx`，存储抽象统一为 `data/storage.ts`，不再有双轨存储抽象。
- 页面：总览、SOS、历史、回放、轨迹、配置、联系人、主题、工具。
- 导航：左上角按钮打开抽屉导航；页面切换仅保留侧边栏入口，不再保留顶部页面跳转条或总览页快捷导航块。
- 配置：电话、短信号码、短信模板、模板变量预览、配置导入 / 导出、版本与配置事实面板、能力边界事实面板；短信预览使用主题色，填充按钮与主题页选中选项悬停态集中使用主题对比色，避免深色 / 浅色模式下低对比度。
- 首次配置：配置页展示定位、后台运行、存储访问权限引导；定位走系统授权弹窗，后台运行打开系统设置，现代 Android 存储导出不申请广泛权限。
- 联系人：新增、编辑、删除、一键填入电话 / 短信字段。
- SOS：5 秒倒计时、取消、定位尝试、结果摘要、步骤状态、重试；非定位失败结果下保留仅拨号 / 仅短信补救动作，定位失败不发送短信或拨打电话。
- 历史：本地 SOS 结果列表与步骤详情。
- 轨迹：手动采样、应用存活期间周期自动采样、待处理队列持久化、本地确认清空；状态字段、UI 和测试均按本地确认语义收口，真实远端同步目标不在当前后端弃用路线中。
- 回放：本地轨迹历史与 SOS 坐标地图化回放（CSS/SVG 画布，无地图 SDK），展示开始点 / 结束点 / S SOS 关键节点、时间轴、轨迹范围、回放时长；只读取本地轨迹历史与 SOS 历史，不接远端、不实时。
- 风险规则：配置页可调整本地风险规则开关与阈值；总览页风险提示尊重本地规则配置并展示触发规则；仍只做本地提示，不自动触发 SOS。
- 主题：明暗模式、预设色、自定义色、Android 动态色接口尝试；选中态 Chip 使用主题对比色处理悬停态。
- 工具：开发者模式下可导出 / 导入本地快照、导出本地诊断报告、预览当前诊断摘要、运行定位自检、查看最近定位自检、粘贴解析外部诊断 JSON、添加模拟联系人、写入模拟轨迹、清空本地数据；诊断报告仅手动导出，不自动上传，且不包含联系人手机号或精确坐标。

- 构建：debug APK、release APK、release AAB、项目外签名配置。

### 4.2 后端 / API 状态

- FastAPI + SQLite 后端代码仍在仓库中，但后续预计弃用。
- `docs/api/README.md` 仅作为历史契约参考，不再代表当前路线图或验收目标。
- 当前 TS 前端主线未默认调用远端 API。
- 后续新增或修订项目状态时，不再以恢复后端联调作为默认目标。

### 4.3 短信模板契约

当前前端预览、TS 本地 SOS 流程和 Android 原生短信尝试统一使用：

- `{userId}`
- `{deviceId}`
- `{lat}`
- `{lng}`
- `{time}`
- `{mapUrl}`

默认模板：

```text
[SOS] 用户{userId}触发报警，位置({lat},{lng}) 地图:{mapUrl} 时间:{time}
```

`{mapUrl}` 当前渲染为高德 URI：

```text
https://uri.amap.com/marker?position={lng},{lat}
```

空模板或仅空白会回退到默认模板；缺位置时地图字段按现有容错策略回退为 `unknown`。

## 5. 当前主要缺口

### P0：可信试用前已按本轮真机验收收口

1. **Android 后台限制 / 前台服务边界澄清**
   - 本轮 Android 真机运行正常无问题，首次启动、权限入口、前台使用和恢复路径已按用户实测收口。
   - 结论仍只覆盖“前台 / 应用存活期间”的当前实现；不实现或承诺长期后台保活、被杀后运行、force-stop 后追踪。
   - 暂不进入短时前台服务 PoC；如未来重新立项，仍必须只描述为短时可观察验证。
2. **Android 原生桥真机验收**
   - TS 已回接 `EmergencyActions`，SOS 短信 / 电话流程会调用已注册 Android 插件，且本轮真机运行正常。
   - TS 已优先调用 `SystemLocationBridge`，会校验坐标有效性；失败或返回非法坐标后改用系统低精度 / 缓存定位重试，避免大陆无 GMS 机型落回 `@capacitor/geolocation` 的 Google Play Services 依赖路径。
   - 权限弹窗、拒权、系统返回、短信 / 拨号用户可见状态按本轮真机结果收口为无异常。
3. **轨迹守护语义收口**
   - 已实现应用存活期间的周期自动采样、本地队列持久化、重启后恢复启用状态，且本轮真机运行正常。
   - “本地确认”已按本地语义收口到 UI、持久化字段和回归测试：清空本地待处理队列，不代表远端 API 同步；后端弃用后不得继续写成远端 API 已接入。
   - 断网、回前台、重启后恢复等场景按本轮真机结果收口为当前入口无异常；不得外推为远端同步或长时后台能力。
4. **工程一致性修复**
   - `frontend/src/data/snapshot.ts` 已使用 `package.json` 版本作为快照版本，配置页已展示前端 / Android、快照、持久化、远端后端状态和能力边界事实，并固定短信预览、全局填充按钮与主题页选中态 Chip 主题对比度。
   - `frontend/package-lock.json` 顶层版本元数据已同步到 `0.4.28`。
5. **回归基线固定**
   - 将 SOS 状态机、Android 能力边界文案、轨迹队列语义、原生桥错误归一、系统定位非法坐标回退、Android 快速低精度优先定位、定位链路自检、首次权限配置引导、本地风险规则配置、诊断报告脱敏导出、诊断摘要解析、导出目录提示、地理围栏窄屏可触达布局纳入稳定回归范围。

### P1：P0 后接续增强

1. **地图化历史回放（最小可用版）✅**
   - 基于现有轨迹 / SOS 历史展示轨迹点、开始 / 结束点、时间轴和关键节点。
   - 只表述为历史回放，不宣称实时地图监护。
2. **模块边界整理 ✅**
   - 保持 `frontend/src/App.tsx` 只做装配。
   - 继续整理 `pages/`、`stores/`、`domain/`、`data/`、`native/` 的边界。
   - stores 已改为通过 data/ repo 文件读写持久化，不再直接 import storage.ts。

### P2：中长期研究，不进入近期承诺

- **本地风险提示 MVP ✅** — `domain/riskAssessment.aggregateRiskData` 聚合轨迹异常、配置缺失、联系人缺失、位置过期，输出统一风险等级和风险项列表；总览页展示风险卡片。仍不自动触发 SOS，纯人工确认。
- **本地地理围栏风险接入 ✅** — 复用现有围栏配置和 `routeGeofenceEvents`，总览页将进入 / 离开围栏事件并入本地风险提示；仍只展示提醒，不自动触发 SOS。
- **本地风险规则中心 ✅** — 配置页可调整轨迹过旧、长时间间断、可疑长停、高速移动、地理围栏、配置完整性和位置新鲜度等本地提示规则；默认值保持既有行为，禁用规则或修改阈值会影响总览风险提示。仍不自动触发 SOS。
- 多协议上行传输、远程控制、传感器触发、硬件联动。
- 风险区域提示、安全导航、安全路线。
- 偷拍检测、AI 情绪陪伴、AI 伪装声音。
- SIM / 关机 / 卸载预警、长期保活、硬件定位模块。

### 下一步改进清单（执行顺序）

> 只按第 3 节能力边界推进：先把 Android MVP / 本地演示底座做成可信试用版本；除非重新立项，不恢复远端后端 / API 联调路线，不承诺实时监护、长时后台或自动报警已完成。

#### A. P0 真机边界收口

- [x] 建立 Android 真机记录结论：本轮真机运行正常无问题，首次启动、定位授权 / 拒权、通知权限、弱网、熄屏、最近任务划掉、force-stop、回前台恢复均按当前入口无异常收口。（真机执行由用户完成）
- [x] 将能力边界事实前置到配置页：明确仅承诺“前台 / 应用存活期间”，后台 / 熄屏 / force-stop 不承诺持续运行。
- [x] 将真机结论回填到第 8 节“Android 真机验证模板”：区分“可承诺能力”“系统限制下的观察结果”“不得承诺项”。（真机执行由用户完成）
- [x] 基于真机结果决定暂不做短时前台服务 PoC；即便未来 PoC 通过，也只描述为短时可观察验证，不写成长时保活。

#### B. P0 原生桥验收

- [x] 用真机覆盖 `EmergencyActions`：短信成功 / 失败、短信分段、拨号成功拉起、拨号失败、无号码配置、权限拒绝，本轮运行正常无问题。（真机执行由用户完成）
- [x] 用回归测试覆盖 `SystemLocationBridge` 的 TS 侧回退：系统桥拒绝或返回非法坐标时回退到 `@capacitor/geolocation`，无效精度归一为 `null`。
- [x] 用真机覆盖 `SystemLocationBridge`：授权成功、拒权、系统定位关闭、超时、返回精度异常、回退到 `@capacitor/geolocation`，本轮运行正常无问题。（真机执行由用户完成）
- [x] 固化用户可见状态：定位失败不发送短信或拨号；非定位失败结果下才保留仅拨号 / 仅短信补救动作。

#### C. P0 轨迹守护语义收口

- [x] 明确“本地确认”只表示清空本地待处理队列，不代表远端同步成功；UI、持久化字段、测试和文档已保持同一口径。
- [x] 真机验证应用存活期间周期采样、重启后恢复启用状态、回前台恢复和弱网 / 断网下队列状态，本轮运行正常无问题。（真机执行由用户完成）
- [x] 若未来重新定义真实同步目标，先写新契约，再改实现；当前实现不再用旧后端 / API 文档作为默认收口路线。

#### D. 工程与发布闸口

- [x] 每次可交付变更同步提升 `frontend/package.json` / `frontend/package-lock.json` 版本，并让 README 的统一事实表跟随版本。
- [x] 每次可交付变更至少运行 `npm run typecheck`、`npm run lint`、`npm test`、`npm run build`；可通过 `npm run check` 一键执行。
- [x] 每次可交付变更刷新 Android 资产并构建 debug / release APK；产物路径仍按第 7.3 节记录。

#### E. P1 增强进入条件

- [x] P0 真机边界和原生桥验收已按本轮实机结果完成，可启动不改变能力承诺的 P1 功能。
- [x] 地图化历史回放只读取本地轨迹 / SOS 历史，展示历史点、开始 / 结束点、时间轴和关键节点；不得写成实时地图监护。
- [x] 模块边界整理优先服务现有职责目录，不引入新的平行架构或第二套状态事实来源。

#### F. 暂不进入近期开发

- [ ] 规则引擎、地理围栏、异常移动识别、自动报警触发链路只保留为 P2 研究项。
- [ ] 风险区域提示、安全导航、安全路线、偷拍检测、AI 情绪陪伴、AI 伪装声音、长期保活和硬件定位模块不进入近期承诺。


## 6. 原始愿景映射

原始需求来自 `神秘组织内部资料.md`。当前映射如下：

| 原始条目 | 当前归属 | 当前判断 |
| --- | --- | --- |
| 及时报警与追踪定位 | 当前主线 | 部分实现：手动 SOS、本地记录、联系人、手动轨迹采样、应用存活期间周期采样底座存在，本地地图化历史回放 MVP 已交付；后台持续追踪、自动触发仍缺失。 |
| 远端身份 / 鉴权 / 最小授权可见 | 历史归档 | 后端预计弃用；当前前端主线不再以正式账号、token、session、远端授权或后端审计为收口目标。 |
| SOS 失败恢复与用户可见状态机 | 当前主线 | 部分实现：TS 入口已有结果摘要、步骤状态和补救动作；原生插件真实返回、权限失败与错误日志归一仍需回接。 |
| Android 后台限制 / 前台服务边界 | 当前主线 | 本轮真机运行正常；结论只覆盖“前台 / 应用存活期间”。Manifest 未声明后台定位、前台服务、开机恢复或保活能力。 |
| 地图化回放 | P1 | 已实现：本地轨迹历史 + SOS 坐标 CSS/SVG 地图化回放（无地图 SDK），含开始/结束点、SOS 关键节点、时间轴、轨迹范围、回放时长；不接远端，不宣称实时地图监护。 |
| 风险区域提示 / 安全路线 | P2 | 方向后移：依赖地图数据、解释性和误导风险评估。 |
| 偷拍检测 / AI 情绪陪伴 / AI 伪装声音 | P2 | 方向后移：技术、隐私、误报和设备差异风险高。 |
| 自动智能报警 / 围栏 / 异常移动 / 传感器触发 | P2 | 未实现：需要规则引擎、误报治理、长期测试数据和安全策略。 |
| 远程录音 / 远程锁机 / 强控制指令 | P2 | 未实现：合规与授权风险高，当前不进入近期承诺。 |
| 锁屏小组件、语音口令、耳机快捷指令 | 未纳入近期规划 | 未实现：当前路线图未拆成执行项。 |
| 安全指导 | 未纳入近期规划 | 原文未形成可验收细化需求。 |

## 7. 运行、测试、构建

### 7.1 前端 Web

```bash
cd frontend
npm install
npm run dev
```

默认地址：`http://127.0.0.1:5173`

### 7.2 前端验证

```bash
cd frontend
npm test
npm run typecheck
npm run build
npm run lint
```

当前回归覆盖：

- `npm test` 覆盖短信模板、SOS 状态归一、轨迹队列、位置新鲜度 hook、SOS 倒计时 hook、原生桥结果映射、系统定位非法坐标回退、轨迹存活期定时采样 / 持久化 / 本地确认、快照版本对齐、侧边栏导航约束、配置页版本与能力边界事实面板、配置页短信预览、全局填充按钮与主题页选中态 Chip 主题对比度。

### 7.3 Android 构建

```bash
cd frontend
npm run build
npm run android:sync
npm run android:apk
npm run android:release
```

产物路径：

- Debug APK：`frontend/android/app/build/outputs/apk/debug/solo-youth-safety-v<version>-debug.apk`
- Release APK：`frontend/android/app/build/outputs/apk/release/solo-youth-safety-v<version>-release.apk`
- Release AAB：`frontend/android/app/build/outputs/bundle/release/solo-youth-safety-v<version>-release.aab`

项目外签名资产：

- 主目录：`/home/crp/.solo-youth-safety/signing`
- 备份目录：`/home/crp/Desktop/solo-youth-safety-signing-backup`
- 可通过 `SAFETY_SIGNING_PROPERTIES_FILE` 覆盖签名属性文件路径。

不要把签名文件、keystore、release-signing.properties 写入仓库。

### 7.4 后端 / API

后端预计弃用，当前不作为运行、验证、路线图或验收目标。`backend/` 与 `docs/api/README.md` 仅保留为历史归档；除非重新立项，不再新增后端运行指引、契约收口或联调任务。

## 8. Android 真机验证模板

每轮真机验证至少记录：

- 设备 / 机型
- Android 版本
- App 版本 / 构建号
- 测试时间
- 网络环境
- 定位权限状态：精确 / 大致、使用期间允许 / 拒绝
- 通知权限状态：Android 13+ 允许 / 拒绝 / 不适用
- 电池优化状态：默认 / 未受限 / 受限 / 厂商策略名
- 是否修改自启动、锁屏清理、后台白名单等厂商开关

必须覆盖的场景：

| 场景 | 记录要求 | 当前口径 |
| --- | --- | --- |
| 首次启动与权限 | 定位权限弹窗、拒绝后提示、页面是否崩溃 | 只验证当前入口行为 |
| 页面导航 | 抽屉、页面切换、开发者模式 7 连击 | 顶部跳转条和总览页快捷导航已移除；页面切换仅保留侧边栏入口 |
| 轨迹守护 | 开关、周期选择、立即采样、待处理数量 | 当前只证明应用存活期间周期采样，不证明后台采样或真实同步目标 |
| SOS 倒计时 | 触发、取消、定位尝试、结果摘要 | 手动 SOS 基础流程 |
| 原生短信 / 电话 | 真机只记录调用尝试和系统返回 | 不承诺短信送达或电话接通 |
| 切后台 5 分钟 | 是否继续采样、是否新增待处理队列 | 不承诺后台常驻 |
| 熄屏 10~15 分钟 | 是否停止、是否延迟、亮屏恢复行为 | 受系统限制 |
| Doze / 长待机 | 采样、写入、本地确认入口是否受影响 | 需日志/截图 |
| 最近任务划掉 | 是否停止、重开后是否恢复本地数据 | 不承诺持续追踪 |
| force-stop | 是否停止、重开后是否仅前台恢复 | 不承诺被杀后运行 |
| 断网后回前台 | 队列数量、恢复网络后的处理行为 | 同步目标与失败重试语义仍待收口 |
| Android 13+/14+ 通知拒绝 | 是否出现通知、是否影响普通页面 | 当前无长期前台服务承诺 |

记录结论时必须写清：本轮只验证“前台 / 应用存活期间”的能力；如果观察到超出当前实现基础的行为，必须附日志 / 截图并标记“需复核”，不得直接写成已承诺能力。

## 9. 目录与文档治理

### 9.1 代码目录

```text
new/
├── frontend/              # React + Vite + Capacitor Android
│   ├── src/               # TS 源码：pages/stores/components/shell/hooks/domain/data/native
│   ├── android/           # Capacitor Android 工程
│   ├── scripts/           # Android release 辅助脚本
│   ├── package.json
│   └── README.md          # 前端专项命令入口，状态以本文件为准
├── backend/               # 历史归档：FastAPI + SQLite，预计弃用
│   ├── main.py
│   ├── tests/test_api.py
│   └── README.md          # 后端归档说明
├── docs/
│   ├── api/README.md      # 历史归档：旧 API 端点参考
│   ├── mvp/               # 已归档的旧路线图 / 审查 / 整改入口
│   ├── ui/                # 已归档的 UI 盘点文档
│   └── superpowers/       # 已归档的 agent 设计 / 实施计划
├── CLAUDE.md              # Agent 操作约束，能力事实以本文件为准
├── README.md              # 当前统一项目文档
└── 神秘组织内部资料.md     # 原始需求 / 调研愿景来源
```

### 9.2 文档维护规则

- 修改当前项目状态、能力边界、路线图、任务清单、审查结论：只更新本 `README.md`。
- 修改前端本地运行命令：可更新 `frontend/README.md`，但不得新增与本文件冲突的项目状态说明。
- 后端 / API 已进入预计弃用状态；除非重新立项，不再维护 `backend/README.md` 或 `docs/api/README.md` 作为当前能力来源。
- `docs/mvp/` 下旧路线图、任务清单、整改入口、审查报告不再作为正式入口；保留文件仅为兼容历史链接。
- `docs/ui/` 与 `docs/superpowers/` 是 agent 产出的历史设计 / 实施资料，不再作为当前实现事实来源。
- `.pi/AGENTS.md` 只保留简短 agent 上下文，事实以本文件为准。

## 10. 历史文档处理状态

以下内容已并入本文件，不再单独维护：

- `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`
- `docs/mvp/TASKS.md`
- `docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`
- `docs/mvp/整改清单与审查入口.md`
- `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`
- `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`
- `docs/mvp/ANDROID_TEST_CHECKLIST.md`

以下内容仅作为历史来源或专项参考：

- `神秘组织内部资料.md`：原始愿景，不代表当前已实现。
- `docs/api/README.md`：旧 API 端点契约归档，不代表当前路线图。
- `docs/ui/UI_FEATURE_INVENTORY.md`：旧 UI 功能盘点，已经归档。
- `docs/superpowers/specs/*.md`：agent 设计稿，已经归档。
- `docs/superpowers/plans/*.md`：agent 实施计划，已经归档。

## 11. 沟通与提交约定

- 默认使用中文。
- commit / PR 描述不得突破第 3 节能力边界。
- 可以说“Android MVP / 本地演示底座”。
- 可以说“前台 / 应用存活期间的手动 SOS、手动采样和本地记录能力”。
- 不要写“实时监护”“长时后台”“自动报警已完成”“正式安全后端”“完整账号体系”“远端后端联调基线”等未实现或已弃用口径。
- 代码注释只解释 WHY，不复述 WHAT。
- 后端 / API 除非重新立项，否则不再作为当前开发目标。
- 前端新增能力优先并入已有职责目录：`pages/`、`stores/`、`components/`、`shell/`、`hooks/`、`domain/`、`data/`、`native/`。
