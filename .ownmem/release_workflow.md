---
name: release_workflow
description: "发版完整工作流顺序，每次发版必须严格执行，避免遗漏步骤"
metadata:
  node_type: memory
  type: lesson
  status: active
  scopes: [release, workflow]
  applies_to: [all]
  triggers: ["发版", "发布", "打包", "release", "workflow", "工作流", "build APK", "tag", "push", "bump", "commit", "Release"]
  last_verified: 2026-08-19
  expires_at: null
  authority: normative
  authority_docs: ["readme.md"]
  history_docs: []
  supersedes: []
  code_evidence: []
  evidence: [commit-bba64dc, release-v0.9.0]
---

# 发版工作流（严格顺序）

每次发版按此顺序执行，**不可跳过或乱序**。完整顺序：

```
code (含 test / typecheck / lint / bump 版本) → commit → push → tag → build → release
```

## 逐步骤细节

### 1. code — 写代码 + 质量门禁 + 版本号

- 实现功能 / 修 bug
- 跑 `npm run check`（typecheck + lint + test + build）确保全绿
- 修好所有失败的测试（不要掩盖失败）
- **bump 版本号**：
  - `cd frontend && npm version <x.y.z> --no-git-tag-version`
  - 同步改 `README.md` 第 22/24 行的版本元数据（`前端 / Android 版本` 和 `package-lock 版本元数据`）
  - `npm version` 已自动同步 `package.json` 和 `package-lock.json`

### 2. commit — 提交

- `git add` 相关文件（含版本 bump 的文件）
- `git commit -m "chore: bump to x.y.z + <说明>"`

### 3. push — 推送主分支

- `git push origin main`
- 注意：本机有代理环境变量（`HTTPS_PROXY=http://127.0.0.1:7890`），代理不稳定时 push 会失败（`Connection closed`）
- **重试技巧**：循环重试 `for i in 1 2 3 4 5; do git push origin main && break; sleep 3; done`

### 4. tag — 打标签并推送

- `git tag vx.y.z <commit> -m "vx.y.z: <说明>"`
- `git push origin vx.y.z`
- **重要**：tag 必须指向 bump 后的最新 commit（含版本号修改），不要指向功能 commit
- 若 tag 已存在且指向旧 commit，用 `git tag -f` + `git push origin vx.y.z --force` 修正

### 5. build — 打包三件套

- debug APK：`cd frontend && npm run android:apk:debug`
  - 产物：`frontend/android/app/build/outputs/apk/debug/solo-youth-safety-vx.y.z-debug.apk`
- release APK + AAB：`cd frontend && npm run android:release`
  - 产物：`frontend/android/app/build/outputs/apk/release/solo-youth-safety-vx.y.z-release.apk`
  - 产物：`frontend/android/app/build/outputs/bundle/release/solo-youth-safety-vx.y.z-release.aab`

### 6. release — 创建 GitHub Release 并上传产物

- `gh release create vx.y.z --title "vx.y.z - <说明>" --notes "<changelog>"`
- 上传三件套：`gh release upload vx.y.z <apk> <aab> <debug-apk> --clobber`
- **重要**：上传必须绕开代理，否则失败（`proxyconnect tcp: dial tcp 127.0.0.1:7890: connect: connection refused`）
  - 用 `env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy` 前缀

## 关键陷阱清单（易错点）

1. **版本 bump 必须在 tag 之前**，且 tag 指向 bump 后的 commit
2. **README.md 版本元数据**要同步更新（第 22/24 行），不是只改 package.json
3. **GitHub Release ≠ git tag**：push tag 不会自动创建 Release，必须 `gh release create`
4. **上传资产会走代理失败**，必须 `env -u` 绕开
5. **push 主分支可能因代理超时**，需要重试循环
6. **AI 回复文本中的中文逗号** `，` 会被测试期望的 ASCII `,` 卡住，保持 ASCII 逗号

## 签名资产（release 构建需要）

- 主目录：`/home/crp/.solo-youth-safety/signing/`
- 备份（以桌面备份为准）：`/home/crp/Desktop/solo-youth-safety-signing-backup/`
- 文件：`solo-youth-safety-release.jks` + `release-signing.properties` + `SHA256SUMS.txt` + `README.txt`
- 若主目录缺失，从备份目录复制回主目录