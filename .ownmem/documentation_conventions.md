---
name: documentation_conventions
description: "项目文档体系和变更维护约定"
metadata:
  node_type: memory
  type: lesson
  status: active
  scopes: [documentation]
  applies_to: [all]
  triggers: ["README", "文档", "文档维护", "事实来源", "统一项目文档", "CLAUDE.md", "AGENTS.md"]
  last_verified: 2026-08-19
  expires_at: null
  authority: observed
  authority_docs: ["readme.md", "claude.md"]
  history_docs: []
  supersedes: []
  code_evidence:
    - {path: "README.md", symbols: [], tests: []}
    - {path: "CLAUDE.md", symbols: [], tests: []}
  evidence: [readme-claude-contents]
---

# 文档体系约定

## 单一事实来源
- **README.md** 统一承担项目状态、能力边界、运行构建、测试验证、路线图、任务清单、审查结论和文档治理职责。
- 其他 README、API 文档、历史计划和审查页只作为专项参考或历史归档。
- 修改项目状态、能力边界、路线图等，只更新 README.md。

## Agent 入口文件
- **CLAUDE.md**：Agent 操作约束，能力事实以 README.md 为准。包含 PreToolUse hook（编辑/写入前触发 ownmem hook）。
- **AGENTS.md**：Codex/其他 agent 适配文件，内容同 CLAUDE.md。

## 已归档文档（不再作为当前状态来源）
- docs/mvp/ 下所有文件
- docs/api/README.md（旧 API 端点归档）
- docs/ui/UI_FEATURE_INVENTORY.md
- docs/superpowers/ 下所有文件
- 神秘组织内部资料.md（原始愿景，不代表已实现）

## 沟通约定
- 默认中文回复，代码注释/提交信息/文档默认中文。
- 不得突破能力边界口径：不写"实时监护""长时后台""自动报警已完成""正式安全后端""完整账号体系"等。
- 可以说"Android MVP/本地演示底座"、"前台/应用存活期间的手动 SOS、手动采样和本地记录能力"。