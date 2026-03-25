# 项目现状评估与下一阶段 Roadmap

更新时间：2026-03-25

## 一句话结论
当前项目已经完成了 **可运行、可安装、可演示的 Android MVP**。下一阶段不再在本文件内扩写完整实施方案，只保留最小路线图索引：优先补齐可信试用所需的工程基线，并将详细分析下沉到 3 份核心规划文档。

## 当前已确认的工程优先顺序（2026-03-24）
本轮已确认采用“**先补文档，再进入实现**”的推进方式，并优先处理以下 5 个工程项：
1. [x] 前后端基础自动化测试与 CI（基础版已接入）
2. [ ] 远端身份 / 鉴权基线与 CORS 收口
3. [ ] SOS 失败恢复与 Android 后台限制边界澄清
4. [ ] 继续拆分大文件、整理模块边界
5. [ ] 统一版本与配置入口 / 收敛本地后端与远端后端的 API 契约一致性

说明：
- 这些项的优先级当前高于联系人角色、历史地图化、风险区域提示等功能增强项。
- Android 后台限制、SOS 失败恢复、立即做 / 延后 / 近期不做的优先级矩阵，不在本文件展开，统一以下沉文档为准：`docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`
- 详细执行依据见：`docs/mvp/PROJECT_IMPROVEMENTS_REVIEW.md`

相关主文档索引：
- `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`：统一总路线图与阶段建议
- `docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`：原始承诺与当前实现状态对照
- `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`：文档与代码已确认不一致点

---

## 当前状态（保留摘要）

### 已达到
- 可运行
- 可安装
- 可演示
- 可在 Android 上独立完成本地闭环验证

### 尚未达到
- 可长期稳定使用
- 可真实对外试用
- 可安全存储敏感数据
- 可发布上线

---

## 下一阶段路线图（仅保留索引）

下一阶段只保留 3 个核心规划入口，避免本文件与专项规划重复扩写：

1. **总路线图与分阶段收敛**  
   `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`
   - 用途：说明为什么当前优先补“可信底座”而不是回到原始大愿景全量扩张。
   - 适合查看：阶段划分、优先级分组、3 个最高优先缺口的选择依据。

2. **原始承诺 vs 当前实现状态总表**  
   `docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`
   - 用途：核对哪些能力已实现、部分实现、未实现或已调整方向。
   - 适合查看：需要判断某项能力是否真的已落地时。

3. **文档与代码不一致点审查**  
   `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`
   - 用途：记录版本口径、安全/CORS 约定与代码现状之间的真实差异。
   - 适合查看：需要判断“文档写法”和“代码事实”是否一致时。

---

## 本文件只保留的最小共识

- 当前主线不是继续横向堆功能，而是先补齐可信试用所需的工程基线。
- 当前优先级仍以后述 5 项为准：测试与 CI、远端身份/鉴权/CORS、SOS 失败恢复与 Android 后台限制边界、模块拆分、版本与配置入口 / API 契约一致性。
- 若要讨论“为什么优先这些、不优先哪些”，以及 Android 后台限制、SOS 失败恢复、优先级矩阵的详细依据，统一跳转到 `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`。
- 若要核对“原始愿景与现状差多少”，统一跳转到 `docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`。
- 若要核对“哪些说法仍属文档约定、哪些已被代码实现”，统一跳转到 `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`。

---

## 配套文档
- 总览：`README.md`
- 前端说明：`frontend/README.md`
- 后端说明：`backend/README.md`
- Android 测试清单：`docs/mvp/ANDROID_TEST_CHECKLIST.md`
- 任务清单：`docs/mvp/TASKS.md`
