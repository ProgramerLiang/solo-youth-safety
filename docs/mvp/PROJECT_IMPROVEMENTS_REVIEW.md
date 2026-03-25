# 项目可改进点评审

更新时间：2026-03-25

## 结论

项目已具备 **可运行、可构建、可演示** 的 Android MVP 闭环；若要从“演示可用”进入“可信试用”，当前应优先补齐工程基线，而不是继续在本文件扩写新的产品/工程大规划。

本文件本轮只保留最小评审结论，详细分析统一下沉到以下 3 份主文档：
- `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`
- `docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`
- `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`

## 当前已确认的优先顺序

1. 前后端基础自动化测试与 CI
2. 远端身份 / 鉴权基线与 CORS 收口
3. 继续拆分大文件、整理模块边界
4. 统一版本与配置入口
5. 收敛本地后端与远端后端 API 契约一致性

说明：
- 本轮原则仍是“先补文档，再进入实现”。
- 更细的阶段划分、原始承诺差异、文档/代码 mismatch，请不要继续堆回本文件，统一查看上述 3 份主文档。

## 本轮仅保留的评审共识

- 当前项目已经不是“能不能跑起来”的问题，而是“能否形成可信、可验证、可继续维护的 MVP 基线”。
- README、Roadmap、TASKS、API 文档必须各司其职，避免把“规划中 / 约定中”的能力写成“当前已具备”。
- 版本口径需要继续收口；若代码与文档现状不同，应以 `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md` 作为审查入口，而不是在本文件重复展开。
- 鉴权、归属校验、CORS 白名单等内容目前仍应按“待实现或联调约定”表述，不能在评审结论里上升为“已落地能力”。

## 参考入口

- 路线图摘要：`docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`
- 执行清单：`docs/mvp/TASKS.md`
- Android 测试清单：`docs/mvp/ANDROID_TEST_CHECKLIST.md`
- 总览：`README.md`

## Soldier Review 最终清单（2026-03-25）

### 最终保留文件
- `README.md`
- `backend/README.md`
- `frontend/README.md`
- `docs/api/README.md`
- `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`
- `docs/mvp/TASKS.md`
- `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`
- `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`
- `docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`

说明：
- 上述文件保留的前提是：它们承担的是总览、API 边界、路线图、任务拆分、原始承诺差异与文档/代码 mismatch 审查职责。
- 其中 `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md` 必须继续作为“代码现状优先”的审查入口，避免后续再次把规划表述误写成已实现能力。

### 已回退文件
- `.gitignore`：已回退本轮越界新增的 `.ant-colony/` 忽略规则。
- `backend/main.py`：已回退到规划任务开始前状态；后端 FastAPI / OpenAPI 版本口径恢复为硬编码 `0.2.1`，不再宣称支持通过 `SAFETY_APP_VERSION` 覆盖。

### 版本口径结论
- **已完成的收口**：文档层面已明确区分“前端 / Android 产物版本基线”与“后端 OpenAPI 当前版本”，不再要求所有端强行共享同一版本号。
- **当前可信现状**：
  - 前端 / Android 产物版本基线：`0.3.0`
  - 后端 OpenAPI / FastAPI 当前版本：`0.2.1`
- **仍需保持的约束**：
  - 不应再把 `SAFETY_APP_VERSION` 写成当前后端已具备的配置能力。
  - 鉴权、归属校验、CORS 白名单仍只可表述为“待实现 / 联调约定 / 后续收口目标”。
- **审查结论**：版本语义已经比此前更清楚，但“跨端统一发布版本策略”仍未完成；现阶段应接受“前端 0.3.0、后端 OpenAPI 0.2.1 并存”的明确口径，而不是把它误写为已经统一。

### 对 `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md` 的最终要求
- 该文档当前应以“后端版本仍为硬编码 `0.2.1`、未实现 `SAFETY_APP_VERSION` 覆盖”为准。
- 若后续代码再次引入版本环境变量能力，必须同步更新该文档，否则会重新制造审查失真。
