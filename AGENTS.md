<!-- ownmem-generated:start ownmem-agent-instructions-v1 -->
## 工程记忆入口

- 改代码或文档前运行: `npx ownmem recall --memory-dir .ownmem -- <问题、路径或符号>`.
- 用户说“记住”时，先判断应由机器门禁、项目规则、权威文档、临时开发包或回归测试承载；只有都不适合时才写长期记忆。
- 写入后运行: `npx ownmem audit --memory-dir .ownmem`. 不要绕过 schema、配额或近重复告警。
- 用户问近期效果时运行: `npx ownmem report --since 7d`; 没有消费/反馈样本时不得声称准确率。
- Launch the local dashboard with `npx ownmem dashboard --open` when the dashboard layer is installed.
- 不调用外部模型，不把多个召回结果重复注入上下文。
<!-- ownmem-generated:end ownmem-agent-instructions-v1 -->
