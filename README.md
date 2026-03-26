# 独行青年安全守护应用

## 项目简介
本项目面向独行青年的人身安全场景，当前已完成一版可运行的 Android MVP，核心方向包括：
- 一键 SOS 报警
- 紧急联系人通知
- 位置记录与轨迹查询（当前为列表 / 时间线查询，不含地图实时轨迹与地图化历史回放）
- Android APK 独立运行（内置本地后端模式）

## 当前版本
- 前端 / Android 产物版本：跟随 `frontend/package.json`（当前基线：`0.3.0`）
- 后端 OpenAPI / 文档版本：以 `backend/main.py` 当前代码为准（当前默认：`0.2.1`）
- 当前前后端版本口径尚未完全统一；已确认的不一致点见 `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`
- `SAFETY_APP_VERSION` 目前**不是**后端现状能力；若文档提到它，只能视为后续配置收口方向，不能视为已支持的环境变量

## 当前阶段
当前项目已完成 **MVP 演示闭环**：
- `frontend`：React + Vite
- `backend`：FastAPI + SQLite
- `android`：Capacitor 6
- 已支持 debug / release APK 构建与安装验证
- 已支持 release AAB 构建
- 已支持 APK 内本地后端模式，无需手机内运行 Python 服务

## 当前能力概览
> P0-3 统一边界摘要：当前可承诺能力仅为 **前台 / 应用存活期间的周期采样 + 本地补发 + 手动 SOS**。当前**不承诺** Android 长时后台保活、被杀后持续追踪、前台服务长期运行方案、自动报警 / 围栏 / 异常检测 / 正式应急平台。

- 首次启动自动申请定位权限
- 配置电话号码 / 短信号码（均可留空）
- 自定义短信模板与变量预览
- 分页面布局（总览 / 守护 / 主题 / 通知配置 / 联系人 / SOS / 历史 / 工具）
- Material Design 动态主题（Android 12+ 默认壁纸吸色）与自定义调色板
- 用户 / 设备标识持久化
- Android 端使用 Native Preferences 持久化关键本地数据
- FastAPI 远端后端已接入 SQLite 持久化
- Android release 签名配置已完成，签名资产主目录与备份目录均在项目外
- 当前位置多次采样刷新、位置新鲜度与定位精度分级提示已接入
- 周期轨迹写入与弱网失败后本地补发队列已接入
- 当前守护能力仅覆盖前台 / 应用存活期间的周期采样 + 本地补发 + 手动 SOS，不承诺 Android 长时后台保活、不承诺被系统杀死后仍持续追踪，也不承诺已具备前台服务长期运行方案
- 工具页当前仅提供最近 1 小时轨迹点列表预览，不提供地图绘制、实时监护端轨迹或地图化历史回放
- 顶部页面跳转条 + 左上角按钮 / 侧滑抽屉导航已接入
- 正式联系人管理（新增 / 编辑 / 删除 / 一键填入号码）
- SOS 5 秒倒计时与取消
- SOS 历史记录与通知详情查看
- SOS 结果摘要与失败恢复提示：当前会把定位失败、远端失败、短信失败、拨号失败、部分成功等结果汇总为用户可见状态，并提供重试、重新获取位置、仅拨号、仅短信、查看失败原因等补救入口
- Android 原生直拨电话 / 直接发送短信（需授予 `CALL_PHONE` / `SEND_SMS`；前端会把 Android 插件返回的 `failed / skipped / dispatched / triggered` 等状态映射为“已尝试发送 / 已尝试拉起 / 权限缺失 / 号码缺失 / 调用异常”等中文状态；其中短信“已尝试发送”仅表示已调用 `SmsManager`，拨号“已尝试拉起”仅表示已启动 `ACTION_CALL`，都不代表已确认短信送达或电话接通）
- 工具页内本地数据面板、联系人 / 轨迹预览（开发者模式隐藏入口）
- 本地快照导出 / 导入
- 基础前端逻辑测试、FastAPI 接口测试与 GitHub Actions CI

## 短信模板占位符
当前短信模板支持以下占位符：
- `{userId}`：用户 ID
- `{deviceId}`：设备 ID
- `{lat}`：纬度
- `{lng}`：经度
- `{time}`：触发时间（对应事件时间戳）
- `{mapUrl}`：地图链接，当前渲染为高德地图 URI（`https://uri.amap.com/marker?position={lng},{lat}`）

当前前后端统一默认模板为：
`[SOS] 用户{userId}触发报警，位置({lat},{lng}) 地图:{mapUrl} 时间:{time}`

说明：
- 空模板或仅包含空白字符的模板，会回退到上述默认模板。
- 若发送时缺少定位信息，`{mapUrl}` 会按现有容错策略回退为 `unknown`。
- 前端预览、本地后端模拟短信、Android 原生短信发送以及后端短信渲染，当前使用同一套占位符：`{userId}` / `{deviceId}` / `{lat}` / `{lng}` / `{time}` / `{mapUrl}`。

## 目录说明
- `frontend/`：React + Vite + Capacitor Android 前端
- `backend/`：FastAPI 后端服务
- `docs/api/`：接口说明
- `docs/mvp/TASKS.md`：当前任务清单
- `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`：文档与代码不一致点（文档可信度 / 版本漂移）
- `docs/mvp/ANDROID_TEST_CHECKLIST.md`：Android 实机测试清单
- `docs/mvp/整改清单与审查入口.md`：权威中文整改入口（`FINAL_AUDIT_REPORT_CN.md`、`FORMAL_GAP_AUDIT_REPORT.md`、`PROJECT_IMPROVEMENTS_REVIEW.md` 已归档/降级，不再作为正式整改主入口）
- `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`：项目现状评估与下一阶段路线图
- `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`：从当前 Android MVP 向原始愿景能力靠拢的总路线图
- `docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`：原始承诺与当前实现状态对照表（已按“已完成 / 部分完成 / 未完成 / 存疑（方向已调整或原文未细化）”统一口径）

## 运行与构建
### 前端（Web）
```bash
cd frontend
npm install
npm run dev
```

### 后端（FastAPI）
```bash
cd backend
python3 -m pip install --user -r requirements.txt
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 基础测试
```bash
cd frontend
npm test

cd ../backend
python3 -m pip install --user -r requirements-dev.txt
python3 -m unittest discover -s tests -v
```

### Android debug APK
```bash
cd frontend
npm run build
npm run android:sync
npm run android:apk
```

APK 输出路径（按版本命名）：
`frontend/android/app/build/outputs/apk/debug/solo-youth-safety-v<version>-debug.apk`

> 默认前端迭代打包流程不仅包含 debug APK，也包含 release APK / AAB；完成 `build + sync + debug APK` 后，继续执行 release 打包。

### Android release APK / AAB
首次生成签名资产（仅需一次）：
```bash
cd frontend
npm run android:release:setup-signing
```

生成 release APK + AAB：
```bash
cd frontend
npm run android:release
```

默认迭代验收打包顺序：
```bash
cd frontend
npm run build
npm run android:sync
npm run android:apk
npm run android:release
```

> 预发 / 生产打包前，请先确认 `VITE_API_BASE_URL` 已指向目标后端环境。

Release 输出路径：
- `frontend/android/app/build/outputs/apk/release/solo-youth-safety-v<version>-release.apk`
- `frontend/android/app/build/outputs/bundle/release/solo-youth-safety-v<version>-release.aab`

当前默认签名文件位置（项目外）：
- 主目录：`/home/crp/.solo-youth-safety/signing`
- 备份目录：`/home/crp/Desktop/solo-youth-safety-signing-backup`

## 下一阶段重点
当前文档索引已收敛为“路线图入口 + 审查总表入口 + 整改清单入口 + 执行任务入口”四层最小结构，避免继续分散到已归档的历史审查报告。

### 本轮文档治理说明
- **正式整改清单唯一入口**：`docs/mvp/整改清单与审查入口.md`
- **权威中文审查总表入口**：`docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`
- **文档清理变更摘要**：
  - **已清理的并列正式入口**：`docs/mvp/FINAL_AUDIT_REPORT_CN.md`、`docs/mvp/FORMAL_GAP_AUDIT_REPORT.md`、`docs/mvp/PROJECT_IMPROVEMENTS_REVIEW.md` 已归档或降级为跳转用途，不再承担正式中文审查或正式整改主入口职责
  - **继续保留的核心文档**：`README.md`、`frontend/README.md`、`backend/README.md`、`docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`、`docs/mvp/TASKS.md`、`docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`、`docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`、`docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`
  - **整改清单落点**：统一维护在 `docs/mvp/整改清单与审查入口.md`，后续不要再新增平行中文整改/审查文档
  - **本轮已完成同步的引用**：本 README、`docs/mvp/TASKS.md`、`docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`、`docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`、`frontend/README.md`、`backend/README.md` 均已改为指向稳定入口；`docs/mvp/FINAL_AUDIT_REPORT_CN.md`、`docs/mvp/FORMAL_GAP_AUDIT_REPORT.md`、`docs/mvp/PROJECT_IMPROVEMENTS_REVIEW.md` 已统一降级为归档跳转页
- **补充保留说明**：
  - `docs/mvp/FORMAL_GAP_AUDIT_REPORT.md`：保留为历史兼容归档页
  - `docs/mvp/PROJECT_IMPROVEMENTS_REVIEW.md`：保留为归档跳转页
  - `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`：路线图入口
  - `docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`：审查总表入口
  - `docs/mvp/TASKS.md`：执行任务入口
  - `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`：专项证据文档
  - `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`：路线图展开文档

详见：
- `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`（路线图入口：当前阶段目标、优先顺序与最小索引）
- `docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`（审查总表入口：正式中文审查结论与证据化状态对照）
- `docs/mvp/整改清单与审查入口.md`（正式整改清单入口：文档清理变更摘要、整改分组、优先级与后续维护规则）
- `docs/mvp/TASKS.md`（执行任务入口：按优先级推进具体待办）
- `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`（路线图展开：立即做 / 延后 / 近期不做的分组依据）
- `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`（补充审查：文档与代码已确认不一致点）

当前这一轮已确认先做文档同步，再进入实现；其中“前后端基础自动化测试与 CI”基础版已接入。

> 统一边界声明：本轮已完成的是 **SOS 失败恢复与用户可见状态机**，以及前台 / 应用存活期间的周期采样、本地补发与手动 SOS 闭环；**不等于** 自动报警、Android 长时后台保活、被系统杀死后仍持续追踪、已具备前台服务长期运行方案、正式应急平台或完整账号体系。下一步进入 **P0-3 Android 后台限制 / 前台服务边界澄清**，继续说明 Android 真实系统限制与可承诺范围。

当前执行优先级已明确收敛为：

### P0
1. SOS 失败恢复与用户可见状态机
2. Android 后台限制 / 前台服务边界澄清
3. 前端统一远端请求头注入、身份错误提示与安全基线回归测试

### P1
1. 地图化历史回放（基于现有轨迹与 SOS 历史，先做回放，不宣称实时地图监护）
2. 统一版本与配置入口
3. 收敛本地后端与远端后端 API 契约一致性
4. 继续拆分大文件、整理模块边界

### P2
1. 围栏 / 异常移动 / 自动报警研究与 PoC
2. 风险区域提示 / 安全导航 / 安全路线
3. 偷拍检测、AI 情绪陪伴、AI 伪装声音等中长期方向

## 隐私合规 / 授权可见现状说明（MVP 最小边界已具备）
原始需求文档对这部分的要求是：**“加密传输与存储，遵循最小权限原则，仅授权账号可见。”**

按当前仓库代码、测试与文档交叉核验，远端模式现已具备 **MVP 级最小授权边界**，但这仍**不是**完整账号体系，也**不是**可直接对外宣称“正式安全后端”的终态：
- `backend/main.py` 已改为通过 `SAFETY_ALLOWED_ORIGINS` 读取 CORS 白名单，不再默认 `allow_origins=["*"]` 全开放。
- 后端已对 health 之外的受保护接口接入最小身份依赖：缺失 `X-Safety-User-Id` 会拒绝，请求头与 query/body 中的 `userId`、`deviceId` 不一致会拒绝，`X-Safety-Client-Mode` 若提供且不为 `remote` 也会拒绝。
- 已补充相应自动化测试，覆盖合法通过、缺失身份、非法客户端模式、头/体不一致、跨用户资源拒绝与 CORS 配置读取。
- 这意味着当前远端后端**已经具备 MVP 级最小授权边界**，可用于联调、内测与可信试用前的基础安全收口。
- 但后端**仍未建立正式登录、token、session、API key、刷新令牌、账号找回、多人共享授权流、多租户授权模型**等完整账号能力；HTTPS 部署、敏感字段存储策略、部署安全模板与审计留痕也仍需继续补齐。
- 因此，联系人、轨迹、SOS 历史等敏感数据，当前只能表述为“已具备最小请求头身份基线与资源归属校验”，**不能**提升表述为“已经完成正式隐私合规与授权账号体系”。

当前可接受的对外口径应是：
- 本项目目前是 **Android MVP / 联调基线**；
- 远端后端已具备 **最小请求头身份基线 + CORS 白名单能力**；
- 但仍**不是完整账号体系**，也不应等同于正式上线形态。

验证 / 运行补充：
- 后端测试：`cd backend && python3 -m unittest discover -s tests -v`
- 前端验证：`cd frontend && npm test && npm run build`
- CORS 白名单环境变量与运行方式见 `backend/README.md`
- 请求头契约与限制见 `docs/api/README.md`

下一步已进入 **P0-3：Android 后台限制 / 前台服务边界澄清**。为避免误解，P0-2 已按“失败恢复与用户可见状态机”口径完成；当前对外仅可表述为**前台 / 应用存活期间的周期采样 + 本地补发 + 手动 SOS**，不承诺 Android 长时后台保活、不承诺被系统杀死后仍持续追踪、不承诺已具备前台服务长期运行方案，也不承诺自动报警与正式应急平台。后续继续收口的是 Android 系统限制说明与真机验证记录，详见：
- `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`
- `docs/mvp/TASKS.md`
- `docs/mvp/整改清单与审查入口.md`
- `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`
