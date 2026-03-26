# 原始文档承诺 vs 当前实现状态总表

更新时间：2026-03-26

> 本文件现为 `docs/mvp/` 下**权威中文审查总表**。
> 权威中文整改入口请使用：`docs/mvp/整改清单与审查入口.md`

## 本轮文档清理说明
为清理重复审查报告与过程评审文档，以下文件已停止作为正式入口维护：
- `docs/mvp/PROJECT_IMPROVEMENTS_REVIEW.md`
- `docs/mvp/FORMAL_GAP_AUDIT_REPORT.md`
- `docs/mvp/FINAL_AUDIT_REPORT_CN.md`

其中仍有长期价值的内容已按职责收敛：
- 审查判定口径、差异总表、规划归属说明：保留在本文件
- 整改分组、优先级、执行边界：迁移到 `docs/mvp/整改清单与审查入口.md`

## 判定口径
- **已实现**：仓库文档与代码已明确表明能力已经完成，且当前版本中可运行或可交付。
- **部分实现**：存在相关基础能力，但距离原始承诺仍有明显差距，仅覆盖其中一部分场景或链路。
- **未实现**：原始文档对该项存在相对明确承诺，且在 README、Roadmap、TASKS 与代码中均未发现对应实现证据，因此应归入真正缺口，而不是简单理解为“文档没写细”。
- **存疑 / 方向已调整**：用于两类情况：
  1. **方向已调整**：原始文档曾提出，但当前项目已明确收缩为 Android MVP，该能力被主动后置、降级为占位项，或已不属于当前阶段主目标；
  2. **原文未细化**：原始文档只给出标题、方向或一句话描述，未形成可稳定验收的细化需求，此时不宜直接按“漏做”定性，而应先标注为存疑。

## 审查注意事项
- 《神秘组织内部资料》中，`3. UI 界面介绍`、`4.2 检测偷拍`、`4.3 安全导航`、`4.4 安全路线` 均明确写有“待完善 / 待补充”，因此这些章节下的细项不能机械地全部打成“未实现”。
- 本报告后文若直接写“方向已调整”，表示项目范围已主动收缩；若未来需要对外汇报，建议统一呈现为 **“存疑（方向已调整 / 原文未细化）”**，避免与“真正遗漏”混淆。
- 因此，只有像 `4.1 报警与追踪定位` 这种原文链路已经较完整、且代码中又确无实现证据的能力，才适合直接归入“未实现”。

## 规划归属判定补充口径
为进一步区分“明确后移”与“仓库从未纳入规划”，本次补充统一使用以下 4 类规划归属：
- **P0（当前主线）**：已在 `README.md`、`TASKS.md`、对齐路线图中明确列为当前或下一轮主线。
- **P1（明确后移）**：已进入路线图的“建议延后”或阶段 3 增强项，表示仓库承认它有价值，但主动后置。
- **P2（明确后移）**：已进入路线图的“近期不做 / 中长期探索项”，表示仓库承认该方向存在，但当前不进入近期承诺。
- **未纳入规划**：在当前 `README.md`、`docs/mvp/TASKS.md`、`docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md` 中都没有进入执行清单、阶段路线或 P1/P2 占位；这类项更接近“当前仓库从未正式纳入规划”，不应误写成“只是延期”。

## 原始文档条目与当前规划归属速查表

| 原始文档条目 | 当前规划归属 | 说明 | 依据 |
| --- | --- | --- | --- |
| 及时报警与追踪定位（MVP 基础闭环） | P0（当前主线） | 当前仓库的核心主线，已形成 SOS、联系人通知、位置记录与轨迹查询的 MVP 闭环。 | `README.md:3-8,145-154`; `docs/mvp/TASKS.md:37-64`; `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md:528-531` |
| 远端身份 / 鉴权 / CORS / 归属校验 | P0（当前主线） | 当前已明确列为最高优先级补洞。 | `README.md:151`; `docs/mvp/TASKS.md:18-26`; `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md:528-531` |
| SOS 失败恢复与 Android 后台限制边界 | P0（当前主线） | 当前已明确列为最高优先级补洞。 | `README.md:152`; `docs/mvp/TASKS.md:28-31`; `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md:528-531` |
| 地图化回放（SOS 历史 / 轨迹） | P0（当前主线） | 已进入“建议立即做”，属于当前最推荐补齐的原始主线差距。 | `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md:221-228,528-531` |
| 风险区域提示 | P1（明确后移） | 已进入“建议延后 / 阶段 3”，但未进入当前主线。 | `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md:242-249,427-429,533-537` |
| 安全路线（占位版） | P1（明确后移） | 已被收缩为“安全路线推荐（占位版）”，明确后移。 | `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md:250-255,427-429,533-537`; `docs/mvp/TASKS.md:75-76` |
| 偷拍检测 | P2（明确后移） | 已进入“近期不做 / 中长期探索项”。 | `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md:258-263,443-455,539-543`; `docs/mvp/TASKS.md:82-87` |
| AI 情绪陪伴 | P2（明确后移） | 已进入“近期不做 / 中长期探索项”。 | `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md:264-268,443-455,539-543`; `docs/mvp/TASKS.md:82-84` |
| AI 伪装声音 / 伪装语音 | P2（明确后移） | 已进入“近期不做 / 中长期探索项”。 | `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md:264-268,443-455,539-543`; `docs/mvp/TASKS.md:83-85` |
| 安全指导 | 未纳入规划 | 原始文档列为核心方向，但当前路线图与任务清单未拆成任何执行项、占位项或阶段目标。 | `神秘组织内部资料.md:26`; `README.md:145-154`; `docs/mvp/TASKS.md:1-89`; `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md:196-543` |
| 锁屏小组件触发报警 | 未纳入规划 | 当前既无实现，也未见进入阶段规划。 | `神秘组织内部资料.md:47`; `docs/mvp/TASKS.md:1-89`; `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md:196-543` |
| 语音口令触发报警 | 未纳入规划 | 当前既无实现，也未见进入阶段规划。 | `神秘组织内部资料.md:47`; `docs/mvp/TASKS.md:1-89`; `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md:196-543` |
| 耳机快捷指令触发报警 | 未纳入规划 | 当前既无实现，也未见进入阶段规划。 | `神秘组织内部资料.md:46`; `docs/mvp/TASKS.md:1-89`; `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md:196-543` |
| 自动智能报警全家桶（围栏 / 异常移动 / 强制确认 / 环境与传感器触发） | P2（明确后移） | 已在路线图中被整体归入“近期不做”。 | `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md:270-275,443-455,539-543` |
| 远程录音 / 远程锁机 / 强控制指令 | P2（明确后移） | 已在路线图中被整体归入“近期不做”。 | `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md:276-281,443-455,539-543` |
| SIM/关机/卸载预警、硬件联动、长时保活 | P2（明确后移） | 已在路线图中被整体归入“近期不做”。 | `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md:282-287,443-455,539-543` |

## 一、用户可感知功能

| 类别 | 原始文档承诺点 | 当前实现状态 | 判定 | 证据 |
| --- | --- | --- | --- | --- |
| 用户可感知功能 | 及时报警与追踪定位 | 当前 MVP 已支持一键 SOS、紧急联系人通知、位置记录与轨迹查询，已形成基础闭环，但距离原文要求的“完整追踪定位体系”仍有差距。 | 部分实现 | `神秘组织内部资料.md:22-28,39-43`; `README.md:3-8,24-34`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:18-31` |
| 用户可感知功能 | App 内 SOS 按钮 | 已支持一键 SOS，且带 5 秒倒计时与取消。 | 已实现 | `神秘组织内部资料.md:47`; `README.md:31-35`; `docs/mvp/TASKS.md:42-45` |
| 用户可感知功能 | 锁屏小组件触发报警 | 当前文档、任务清单、代码范围内均无锁屏小组件实现证据。 | 未实现 | `神秘组织内部资料.md:47`; `README.md:3-34`; `docs/mvp/TASKS.md:1-89` |
| 用户可感知功能 | 语音口令触发报警 | 当前未见语音口令触发链路，也未进入 Roadmap/P1/P2。 | 未实现 | `神秘组织内部资料.md:47`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:1-233`; `docs/mvp/TASKS.md:1-89` |
| 用户可感知功能 | 耳机快捷指令触发报警 | 当前未见耳机硬件快捷触发实现。 | 未实现 | `神秘组织内部资料.md:46`; `docs/mvp/TASKS.md:1-89` |
| 用户可感知功能 | 群发位置短信 | 当前支持短信号码配置、短信模板、自定义变量预览，以及 Android 原生直发短信；但未见“群发”策略，也未见自动对多联系人群发。 | 部分实现 | `神秘组织内部资料.md:50`; `README.md:16-34`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:18-31`; `docs/mvp/TASKS.md:37-64` |
| 用户可感知功能 | AI 拨打紧急号码并说明情况 | 当前仅支持 Android 原生直拨电话，无 AI 拨号或自动说明链路。 | 部分实现 | `神秘组织内部资料.md:51`; `README.md:31-35`; `docs/mvp/TASKS.md:61` |
| 用户可感知功能 | 联系人通知 | 当前已支持正式联系人管理、SOS 通知模拟、原生电话/短信链路。 | 已实现 | `README.md:24-35`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:18-31`; `docs/mvp/TASKS.md:37-64` |
| 用户可感知功能 | 位置轨迹查询（列表 / 时间线） | 当前已支持位置记录、`/api/v1/tracking/timeline` 时间范围查询，以及工具页“最近 1 小时轨迹”列表预览；这证明“有轨迹查询”，但仅限点位列表 / 时间线层级。 | 已实现 | `README.md:3-8,24-35`; `frontend/src/App.jsx:1868-1886,2178-2185`; `backend/main.py:563-583`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:31-39,83-96`; `docs/mvp/TASKS.md:38-40,58-60` |
| 用户可感知功能 | 地图实时轨迹展示 | 当前前端未发现地图容器、轨迹绘制或监护端地图页面；后端也仅返回点位数组，不提供实时推送或地图渲染相关能力，因此“实时地图轨迹”仍未实现。 | 未实现 | `神秘组织内部资料.md:76-81`; `frontend/src/App.jsx:1868-1886`; `backend/main.py:563-583`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:74-78,161-166`; `docs/mvp/TASKS.md:74-80` |
| 用户可感知功能 | 历史回放（地图化 / 回放动画） | 当前只有轨迹点时间范围查询、SOS 历史记录与详情查看；尚无地图底图、轨迹连线、播放进度控制或按时间回放 UI，因此原始承诺中的“地图化历史回放”应单列为未实现，不能与轨迹查询混同。 | 未实现 | `神秘组织内部资料.md:84`; `README.md:24-35`; `frontend/src/App.jsx:1868-1886,2178-2185`; `backend/main.py:563-583`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:72-78,127-133`; `docs/mvp/TASKS.md:65-80` |
| 用户可感知功能 | 安全指导 | 原始文档列为首批核心功能，但当前 MVP 范围与任务清单未纳入。 | 方向已调整 | `神秘组织内部资料.md:26`; `README.md:3-8`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:5-6,161-166`; `docs/mvp/TASKS.md:74-89` |
| 用户可感知功能 | 安全路线（有摄像头路段、危险预警导航） | 当前 Roadmap/TASKS 明确仅保留“安全路线推荐（占位版）”为后续项，尚未进入现版。 | 方向已调整 | `神秘组织内部资料.md:27`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:161-166,217-222`; `docs/mvp/TASKS.md:75-76` |
| 用户可感知功能 | 风险区域提示 | 已被列入 P1，但当前尚未完成。 | 方向已调整 | `神秘组织内部资料.md:27`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:161-166,217-222`; `docs/mvp/TASKS.md:74-75` |
| 用户可感知功能 | 偷拍检测 | 原始文档列为核心功能，当前被放入 P2，尚无实现。 | 方向已调整 | `神秘组织内部资料.md:15,24,87`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:168-173`; `docs/mvp/TASKS.md:82-87` |
| 用户可感知功能 | AI 情绪陪伴 | 原始文档作为辅助差异化功能提出，当前被放入 P2。 | 方向已调整 | `神秘组织内部资料.md:28,85`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:168-173`; `docs/mvp/TASKS.md:82-84` |
| 用户可感知功能 | AI 伪装声音/伪装语音 | 当前仅在 P2 中保留为可选项，未进入 MVP。 | 方向已调整 | `神秘组织内部资料.md:28,88`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:168-173`; `docs/mvp/TASKS.md:83-85` |

## 二、后端能力

> 整改拆分口径：后端缺口不要再混写成一个“大技术债”。当前应先把 **鉴权 / CORS / 授权可见 / 资源归属校验** 视为 P0 安全边界；**规则引擎、围栏、异常检测、分级响应、多协议上行** 归入后续能力缺口，避免与安全基线混排。
>
> - **P0（后端安全边界）**：鉴权占位、CORS 白名单、授权可见、资源归属校验。
> - **后续缺口（后端能力扩展）**：规则引擎、地理围栏、异常识别、分级响应、多协议上行，以及其依赖的数据模型与误报治理。

| 类别 | 原始文档承诺点 | 当前实现状态 | 判定 | 证据 |
| --- | --- | --- | --- | --- |
| 后端能力 | 断网缓存、联网后批量补传 | 当前已支持周期轨迹写入与弱网失败后的本地补发队列。 | 已实现 | `神秘组织内部资料.md:68`; `README.md:24-35`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:29-31,83-91,145-147`; `docs/mvp/TASKS.md:58-60,73-74` |
| 后端能力 | 云端接收告警并入库形成轨迹 | FastAPI + SQLite 已实现 SOS 与轨迹落库，数据库表已建立。 | 已实现 | `神秘组织内部资料.md:71`; `README.md:18-34`; `backend/main.py:167-206`; `docs/mvp/TASKS.md:37-64` |
| 后端能力 | 规则引擎匹配预设条件、触发分级响应 | 当前数据库和 API 范围未见规则引擎、分级响应或联动机制；此项应归入后续后端能力缺口，而非与 P0 安全边界混写。 | 未实现 | `神秘组织内部资料.md:72`; `backend/main.py:167-206`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:37-52,168-173`; `docs/mvp/TASKS.md:55-67` |
| 后端能力 | 推送/短信/电话/联动警方的分级响应 | 当前仅有基础通知模拟与 Android 电话/短信链路，未见分级响应或对警方联动；应归入后续后端编排能力，而不是替代授权边界整改。 | 部分实现 | `神秘组织内部资料.md:72`; `README.md:31-35`; `backend/main.py:287-340`; `docs/mvp/TASKS.md:55-67` |
| 后端能力 | 位置纠偏、漂移过滤、路径平滑 | 目前只看到多次采样与定位精度分级提示，未见服务端地图纠偏/路径平滑。 | 部分实现 | `神秘组织内部资料.md:73`; `README.md:24-35`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:27-30,83-91` |
| 后端能力 | 地理围栏自动告警 | 当前未实现；代码中未见围栏配置、围栏命中判定、自动触发源或规则执行入口。该项应归入后续后端能力缺口。 | 未实现 | `神秘组织内部资料.md:58`; `backend/main.py:31-70,455-492`; `frontend/src/App.jsx:224-236,2992-3018`; `docs/mvp/TASKS.md:55-67` |
| 后端能力 | 长时间静止/高速移动/跨区域跳转等异常识别 | 当前未见异常识别规则、阈值配置、轨迹分析任务或自动触发事件模型；现有轨迹逻辑仅负责采样、排队与补发。该项应归入后续后端能力缺口。 | 未实现 | `神秘组织内部资料.md:59`; `backend/main.py:31-70,455-492`; `frontend/src/tracking.js:1-342`; `docs/mvp/TASKS.md:55-67` |
| 后端能力 | 关机前位置上报、SIM 拔出、刷机/卸载预警 | 当前无设备状态监测、广播接收器或系统级预警实现。 | 未实现 | `神秘组织内部资料.md:60`; `frontend/src/App.jsx:72-117`; `docs/mvp/TASKS.md:1-89` |
| 后端能力 | 高分贝/跌倒/碰撞检测自动报警 | 当前未见麦克风、加速度计/运动传感器接入，也未见基于传感器事件的自动报警规则。 | 未实现 | `神秘组织内部资料.md:61`; `frontend/src/permissions.js:1-481`; `frontend/src/App.jsx:224-236,2992-3018`; `docs/mvp/TASKS.md:1-89` |
| 后端能力 | 超时未确认自动报警 | 当前只有用户主动点击后进入 5 秒倒计时，倒计时结束仍走 `createSosPayload()` 的 `triggerType: 'manual'`；未见“两分钟未确认自动报警”的确认超时流程，因此不能算部分实现。 | 未实现 | `神秘组织内部资料.md:62`; `frontend/src/App.jsx:224-236,2440-2451,2578-2607,2992-3018`; `backend/main.py:31-40,455-492`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:18-23` |
| 后端能力 | 多协议上行传输（TCP/UDP、MQTT、HTTP/HTTPS） | 当前后端为 FastAPI HTTP API，未见 TCP/UDP/MQTT；该项应归入后续后端接入能力缺口，不应与 P0 授权边界混排。 | 部分实现 | `神秘组织内部资料.md:69`; `backend/main.py:1-340`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:31-39`; `docs/mvp/TASKS.md:55-67` |
| 后端能力 | 远程指令（静音录音、远程锁机） | 当前未见远程控制接口、数据表或客户端实现。 | 未实现 | `神秘组织内部资料.md:84`; `backend/main.py:167-206`; `docs/mvp/TASKS.md:1-89` |
| 后端能力 | 开启录音/拍照并上报 | 当前无录音/拍照采集、上传或存储链路。 | 未实现 | `神秘组织内部资料.md:49`; `backend/main.py:167-206` |
| 后端能力 | 上报一小时通话记录 | 当前无通话记录权限、采集或上传能力。 | 未实现 | `神秘组织内部资料.md:48`; `backend/main.py:1-340` |
| 后端能力 | 后台长期追踪/守护 | 当前仅覆盖 **前台 / App 存活期间** 的周期轨迹写入；Android Manifest 只声明了 `INTERNET`、`ACCESS_COARSE_LOCATION`、`ACCESS_FINE_LOCATION`、`CALL_PHONE`、`SEND_SMS`，未声明 `ACCESS_BACKGROUND_LOCATION`、前台服务、保活或被杀后恢复链路，**不承诺应用被系统杀进程后继续追踪**。 | 未实现 | `神秘组织内部资料.md:39-43,67-81`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:83-96,145-147`; `frontend/android/app/src/main/AndroidManifest.xml:1-52` |
| 后端能力 | 隐私合规：加密传输存储、最小权限、仅授权账号可见 | 当前 Roadmap 明确指出后端未做鉴权、CORS 全开放、本地敏感数据明文存储；这是后端整改中的 **P0 安全边界**，不应被规则引擎等后续能力稀释。 | 未实现 | `神秘组织内部资料.md:79-80`; `backend/main.py:18-27`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:108-113,117-123`; `docs/mvp/TASKS.md:14-21` |
| 后端能力 | 正式账号与授权可见模型 | 当前仅有本地持久化的 `userId/deviceId`，远端身份体系仍待补强；应与请求头身份声明、资源归属校验一起作为 **P0 授权可见** 收口项推进。 | 部分实现 | `神秘组织内部资料.md:80`; `backend/main.py:31-70`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:97-107,127-133`; `docs/mvp/TASKS.md:14-21` |

## 三、Android / 发布能力

| 类别 | 原始文档承诺点 | 当前实现状态 | 判定 | 证据 |
| --- | --- | --- | --- | --- |
| Android/发布能力 | 获取精准定位权限（含前后台） | 当前仅见首次启动申请前台定位权限（coarse/fine）；Android Manifest 现状仅声明 `ACCESS_COARSE_LOCATION` 与 `ACCESS_FINE_LOCATION`，**未声明 `ACCESS_BACKGROUND_LOCATION`**，因此只能证明“前台可获取较精准定位”，**不能表述为已具备前后台持续追踪授权**。 | 部分实现 | `神秘组织内部资料.md:35-37`; `README.md:15-18`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:18-19,92-96`; `frontend/android/app/src/main/AndroidManifest.xml:1-52` |
| Android/发布能力 | 报警/追踪模式下高频定位轮询 | 当前仅见 **前台 / App 存活期间** 的周期轨迹写入与 SOS 前多次采样；结合 Android Manifest 仅有网络、前台定位、电话、短信权限这一事实，未见 1~10 秒高频后台轮询、前台服务或被杀后继续采样能力，**不承诺应用退出或被系统杀进程后继续追踪**。 | 部分实现 | `神秘组织内部资料.md:39-43`; `README.md:24-35`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:27-30,83-96`; `frontend/android/app/src/main/AndroidManifest.xml:1-52` |
| Android/发布能力 | Android APK 独立运行 | 当前 README 与 Roadmap 已明确支持 APK 内本地后端模式。 | 已实现 | `README.md:3-18,55-94`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:31-39,41-48` |
| Android/发布能力 | debug APK 构建与安装验证 | 已完成。 | 已实现 | `README.md:12-18,55-73`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:49-53`; `docs/mvp/TASKS.md:63-64` |
| Android/发布能力 | release APK 构建 | 已完成。 | 已实现 | `README.md:12-18,75-103`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:49-53`; `docs/mvp/TASKS.md:63-64` |
| Android/发布能力 | release AAB 构建 | 已完成。 | 已实现 | `README.md:12-18,75-103`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:49-53` |
| Android/发布能力 | release 签名配置与签名资产管理 | 已完成，且签名资产主目录与备份目录均在项目外。 | 已实现 | `README.md:25-34,75-103`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:49-53,114-116`; `docs/mvp/TASKS.md:56-64` |
| Android/发布能力 | 正式发布物料与渠道分发策略 | Roadmap 明确指出仍缺少图标、启动图、正式发布清单与渠道分发策略。 | 部分实现 | `README.md:75-103`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:114-116,137-144` |
| Android/发布能力 | 保活机制、防止 App 被系统杀进程 | 当前暂无 Android 前台服务或后台守护方案。 | 未实现 | `神秘组织内部资料.md:77`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:92-96,145-147` |
| Android/发布能力 | 断电防失效、独立电池定位模块联动 | 当前仓库未见硬件联动实现。 | 未实现 | `神秘组织内部资料.md:78`; `docs/mvp/TASKS.md:1-89` |

## 四、测试 / 工程能力

| 类别 | 原始文档承诺点 | 当前实现状态 | 判定 | 证据 |
| --- | --- | --- | --- | --- |
| 测试/工程能力 | 后台服务器上报告警 | 当前后端已具备 SOS 事件接收、入库与通知日志能力。 | 已实现 | `神秘组织内部资料.md:52`; `backend/main.py:167-206`; `docs/mvp/TASKS.md:37-41` |
| 测试/工程能力 | 轨迹数据结构化存储 | 当前 SQLite 中已有 `tracking_points`、`sos_events`、`sos_notifications` 等表。 | 已实现 | `神秘组织内部资料.md:41`; `backend/main.py:167-206` |
| 测试/工程能力 | 基础前端逻辑测试 | 已接入。 | 已实现 | `README.md:34`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:38-39,118-123`; `docs/mvp/TASKS.md:8-10` |
| 测试/工程能力 | FastAPI 接口测试 | 已接入。 | 已实现 | `README.md:34`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:38-39,118-123`; `docs/mvp/TASKS.md:7-10` |
| 测试/工程能力 | GitHub Actions CI | 已接入前端 build/test 与后端测试双作业。 | 已实现 | `README.md:34`; `.github/workflows/ci.yml:1-48`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:38-39,118-123` |
| 测试/工程能力 | 工程化交付闭环 | 当前已具备 MVP 级构建、测试、CI、签名与 Android 产物输出，但仍缺鉴权、CORS 收口、契约一致性等。 | 部分实现 | `README.md:9-18,36-44,75-103`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:7-16,118-123,204-209`; `docs/mvp/TASKS.md:1-35` |
| 测试/工程能力 | 后端安全基线 | 当前仍未完成鉴权与 CORS 收口，任务清单将其列为本轮优先项。 | 部分实现 | `backend/main.py:18-24`; `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:7-16,108-113`; `docs/mvp/TASKS.md:12-16` |
| 测试/工程能力 | 复杂后台能力的数据模型支撑 | 当前数据库表仅覆盖 `emergency_configs`、`contacts`、`tracking_points`、`sos_events`、`sos_notifications`，无法支撑规则引擎、围栏、远程指令等高级能力。 | 未实现 | `backend/main.py:167-206` |

## 五、当前实现证据清单

> 目的：按证据文件归档当前**已经落地**的 MVP / 工程能力，避免差异审查只聚焦原始愿景缺口，而忽略项目现阶段已具备的可运行、可构建、可测试、可交付能力。

### 提交说明 / PR 审查备注（P0-3 边界澄清）
- 本次提交属于 **能力边界澄清**，不是新增 Android 后台追踪、前台服务保活或被杀恢复能力。
- 审查时请以 `frontend/android/app/src/main/AndroidManifest.xml` 为事实依据：当前仅声明 `INTERNET`、`ACCESS_COARSE_LOCATION`、`ACCESS_FINE_LOCATION`、`CALL_PHONE`、`SEND_SMS`。
- 因 Manifest **未声明** `ACCESS_BACKGROUND_LOCATION`，也未体现前台服务 / 保活 / 开机恢复相关声明，所以本轮文案调整只能收口为“前台 / App 存活期间周期采样 + 本地补发 + 手动 SOS”。
- 若提交说明、PR 描述或评审意见中出现“新增后台定位”“支持被杀后继续追踪”“已具备 Android 守护能力”等表述，应视为与代码事实不符并要求修正。

### 1. `README.md`
- `README.md:3-18`：明确项目当前定位为 **Android MVP 演示闭环**，主干能力是“一键 SOS / 紧急联系人通知 / 位置记录与轨迹查询 / APK 内本地后端模式”。
- `README.md:20-35`：汇总了当前已落地的用户可感知能力，包括定位权限申请、短信模板、主题、用户/设备标识持久化、联系人管理、SOS 倒计时、历史记录、原生电话/短信、轨迹补发、本地快照等。
- `README.md:55-103`：给出 Android `debug APK`、`release APK`、`release AAB` 的实际构建命令、输出路径，以及 release 签名资产存放位置，能直接证明发布链路不是停留在口头描述。
- `README.md:41-54,104-115`：给出前后端目录、基础测试命令、下一阶段重点，说明当前仓库已具备文档化的工程交付入口。

### 2. `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`
- `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:5-16`：明确当前结论是 **“可运行、可安装、可演示的 Android MVP”**，且工程优先顺序已从“堆功能”转向“补测试、补鉴权、收契约、做收口”。
- `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:20-39`：系统列出当前已完成的产品闭环与技术实现，包括 SOS、联系人、历史、定位采样、周期轨迹、弱网补发、抽屉导航、本地后端模式、SQLite 持久化、基础测试与 GitHub Actions CI。
- `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:41-48`：归档本地后端已覆盖的 MVP API 范围，证明当前实现并非只有前端页面，而是已有完整本地接口闭环。
- `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:49-53`：明确记录已成功构建 `debug APK`、`signed release APK`、`release AAB`，可作为 Android 发布能力的核心审查证据。
- `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md:118-123`：说明前端基础逻辑测试、后端基础接口测试、CI 已接入，虽然覆盖仍薄，但工程化基线已经存在。

### 3. `docs/mvp/ANDROID_TEST_CHECKLIST.md`
- `docs/mvp/ANDROID_TEST_CHECKLIST.md:3-67`：按“首次启动/引导配置/主题/轨迹守护/SOS 流程/触发结果”拆成实机验收项，可证明当前 MVP 已具备可操作、可逐项核验的移动端测试口径，而非仅有概念描述。
- `docs/mvp/ANDROID_TEST_CHECKLIST.md:69-81`：对 `npm run build`、`android:sync`、`android:apk`、`android:release:setup-signing`、`android:release`、版本化 APK/AAB 命名、项目外签名目录、安装验证给出逐项验收标准，直接支撑“Android 发布链路已形成检查闭环”。

### 4. `.github/workflows/ci.yml`
- `.github/workflows/ci.yml:1-18`：CI 在 `push main` 与 `pull_request` 上触发，说明仓库已经把基础质量检查放入持续集成，而不是仅依赖本地手工验证。
- `.github/workflows/ci.yml:8-28`：前端 job 会执行 `npm ci`、`npm test`、`npm run build`，证明前端测试与构建已纳入自动化流水线。
- `.github/workflows/ci.yml:30-49`：后端 job 会安装开发依赖并运行 `python -m unittest discover -s tests -v`，证明后端接口回归同样进入 CI。

### 5. `backend/tests/test_api.py`
- `backend/tests/test_api.py:24-33`：测试基座通过临时数据库加载后端模块，说明接口测试不是直接依赖开发期内存状态，而是覆盖了基础持久化路径。
- `backend/tests/test_api.py:63-68`：覆盖 `GET /api/v1/health` 健康检查。
- `backend/tests/test_api.py:69-84`：覆盖紧急配置保存、读取、模板合法性校验。
- `backend/tests/test_api.py:85-126`：覆盖联系人新增、查询、更新、删除完整 CRUD 回路。
- `backend/tests/test_api.py:127-147`：覆盖轨迹点写入、时间线查询、时间范围非法校验。
- `backend/tests/test_api.py:148-185`：覆盖 SOS 事件入库、通知结果生成、历史查询与通知详情返回，说明当前后端核心闭环已有自动化回归证据。

### 6. 可直接用于最终审查结论的一句话
- **当前版本确实没有兑现原始文档中的大部分高阶安全能力，但它已经具备了一个 Android 安全 MVP 应有的最小工程闭环：能构建、能签名、能安装、能测试、能在 CI 中持续验证。**

## 六、汇总结论

### 1. 建议最终中文报告统一使用的四类表述
为避免把“范围收缩”与“真实缺口”混在一起，最终中文报告建议统一写成：
- **已完成**：当前仓库已能证明功能闭环存在；
- **部分完成**：有基础能力，但离原始承诺仍有明显差距；
- **未完成**：原始文档对能力描述已经相对明确，且当前确无实现证据，属于真正遗漏；
- **存疑（或方向已调整）**：原始文档正文不完整、无法稳定验收，或项目已明确把该方向后移，不宜直接算作漏做。

### 2. 当前真正已经落地的主干能力
当前仓库已经落地并可被证明的能力，主要集中在 **Android MVP 演示闭环**：
- 一键 SOS
- 紧急联系人管理与基础通知链路
- 位置记录、轨迹时间线查询、弱网补发
- APK 内本地后端模式
- debug/release APK 与 release AAB 产物链路
- 基础测试与 GitHub Actions CI

### 3. 与原始文档差距最大的、可直接认定为“未完成”的部分
与《神秘组织内部资料》相比，当前最明确的真正缺口集中在：
- **自动智能报警**：当前仅在后端 `SosEvent` 数据模型中预留 `triggerType: "auto"` 字段，但前端 `createSosPayload()` 与 `executeSos()` 仍只生成并上报 `manual` 事件；地理围栏、异常移动、SIM/卸载/关机预警、跌倒/碰撞/高分贝检测、超时未确认自动报警均未实现。
- **高级后台能力**：规则引擎、地图纠偏、地图实时轨迹、历史地图回放、远程录音/锁机、多协议传输均未落地。
- **安全与隐私基线**：原始文档强调授权可见、加密与最小权限，但当前后端仍未完成鉴权，且 CORS 全开放。

### 4. 应归入“存疑 / 方向已调整”的部分
以下能力不宜简单写成“漏做”，更合理的口径是“存疑 / 方向已调整”：
- **偷拍检测、安全导航、安全路线、AI 情绪陪伴、AI 伪装声音**：这些方向虽然在原始文档中被列为首批核心或辅助能力，但正文并未形成完整验收定义，且当前项目已明确收缩为 Android MVP，并将其后移到 P1/P2 或占位项。
- **UI 细项要求**：由于 `3. UI 界面介绍` 原文本身未展开，不能反推出现有 UI 与“原始设计稿”逐项不符。

### 5. 最合理的整体判断
如果以《神秘组织内部资料》作为“原始承诺”，那么当前仓库状态可概括为：
- **MVP 核心闭环已实现**；
- **4.1 报警与追踪定位中的大量高级链路仍未完成**；
- **而偷拍检测 / 安全导航 / 安全路线 / AI 辅助等方向，更多应被归类为“存疑（原文未细化）或方向已调整”，不能简单等同于漏做**。
