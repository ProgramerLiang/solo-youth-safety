# MVP 开发任务清单

更新时间：2026-03-25

## 本轮优先任务（已确认）
本轮先做文档同步，再进入实现；当前已完成第 1 项基础版，其余继续按以下顺序推进。

> 规划归档说明：详细差异分析与阶段路线请优先查看 `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`、`docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`、`docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`；本文件只保留执行清单，不继续扩写新的大段规划说明。

### 1. 前后端基础自动化测试与 CI
- [x] 后端引入测试依赖并建立基础接口测试目录
- [x] 前端引入测试脚本并补核心逻辑测试
- [x] 建立最小 CI：至少执行前端 build + 测试、后端测试
- [x] 为关键接口与模板逻辑补回归校验

### 2. 远端身份 / 鉴权基线与 CORS 收口
- [ ] 明确 MVP 级鉴权占位方案（`userId + deviceId + 请求头身份声明`）
- [ ] 后端按鉴权身份补最小归属校验（头/体一致、资源归属、越权拒绝）
- [ ] CORS 改为按环境配置白名单
- [ ] 前端统一远端请求头注入与 4xx 身份错误提示
- [ ] 为跨用户读写、头/体不一致、缺失请求头补接口测试
- [ ] README / API 文档同步远端访问约束

### 3. SOS 失败恢复与 Android 后台限制边界
- [ ] 明确定位失败、联网失败、短信失败、拨号失败时的用户可见反馈
- [ ] 补齐 SOS 状态机与失败恢复提示
- [ ] 产出 Android 后台限制 / 前台服务边界说明与真机验证记录
- [ ] 明确哪些守护能力仅为研究 / PoC，哪些不进入近期承诺

### 4. 继续拆分大文件、整理模块边界
- [ ] 继续拆分 `frontend/src/App.jsx`
- [ ] 继续拆分 `frontend/src/pageComponents.jsx`
- [ ] 继续整理 `frontend/src/api.js` 的本地 / 远端边界
- [ ] 规划并开始拆分 `backend/main.py`

### 5. 统一版本与配置入口 / 收敛本地后端与远端后端 API 契约一致性
- [ ] 前端 API 地址改为环境变量配置
- [ ] 明确前后端版本同步策略
- [ ] 收敛 README / 前端 README / 后端 README 的环境配置说明
- [ ] 明确“本地后端 = 远端 API 镜像”原则
- [ ] 对齐主要响应结构与错误结构
- [ ] 为关键接口补契约测试或契约对照检查

---

## 规划文档入口（保留最小索引）

以下 3 份文档负责承载较完整的规划分析；本文件只保留执行入口，不再重复展开长篇 roadmap：

1. `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`
   - 查看原因：需要理解为什么当前优先补工程基线，以及“建议立即做 / 建议延后 / 不建议近期做”的分组依据。

2. `docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`
   - 查看原因：需要核对原始承诺与当前实现状态时使用。

3. `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`
   - 查看原因：需要核对版本口径、安全约定、文档与代码是否一致时使用。

---

## 已完成（当前 MVP）
- [x] 明确技术栈与部署方案（FastAPI + React/Vite + Capacitor Android）
- [x] 建立用户 / 设备 / 联系人 / 轨迹 / SOS 基础数据模型
- [x] 实现 SOS 事件上报接口
- [x] 实现实时位置上报接口（`/tracking/points`）
- [x] 实现位置轨迹查询接口（`/tracking/timeline`）
- [x] 实现紧急联系人通知模拟
- [x] 完成 Android 首次启动权限引导
- [x] 完成 SOS 倒计时与取消
- [x] 完成短信模板自定义与变量预览
- [x] 完成 Android APK 本地后端模式（standalone）
- [x] 完成本地数据面板、联系人/轨迹预览
- [x] 完成本地快照导出 / 导入
- [x] 完成自适应多页面布局重组（总览 / 守护 / 主题 / 配置 / 联系人 / SOS / 历史 / 工具）
- [x] 完成页面跳转条 + 抽屉侧边栏导航（顶部跳转 + 左上角按钮 + 页面空白处右滑呼出 + 左滑收起）
- [x] 完成 Material 动态主题（壁纸吸色 / 预设 / 自定义调色板）
- [x] 完成开发者模式隐藏入口（五连击版本号显示工具页）
- [x] 完成远端后端 SQLite 持久化
- [x] 完成 release 签名配置（签名资产与备份均在项目外）
- [x] 完成位置刷新入口与位置新鲜度提示
- [x] 完成多次采样与定位精度分级提示
- [x] 完成周期轨迹写入 / 弱网补偿策略（自动采样 + 本地待补发队列）
- [x] 完成 SOS 原生直拨 / 直发短信链路（权限申请 + 原生日志）
- [x] 完成 debug / release / AAB 构建链路

## 当前执行共识（最小同步）
- [x] 基础测试与 CI 已接入
- [ ] 远端身份 / 鉴权 / CORS 仍待收口
- [ ] SOS 失败恢复与 Android 后台限制边界仍待收口
- [ ] 模块边界与大文件拆分仍待推进
- [ ] 版本与配置入口 / 本地远端 API 契约一致性仍待统一

## 参考文档
- `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`
- `docs/mvp/ANDROID_TEST_CHECKLIST.md`
- `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`
- `docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`
- `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`
- `frontend/README.md`
- `backend/README.md`
