# Frontend 专项入口

当前项目状态、能力边界、路线图与任务清单统一维护在 `../README.md`。本文件只保留前端本地运行与构建命令，避免形成第二套项目说明。

## 运行

```bash
cd frontend
npm install
npm run dev
```

默认地址：`http://127.0.0.1:5173`

## 验证

```bash
cd frontend
npm test
npm run typecheck
npm run build
npm run lint
```

当前 `npm run lint` 不再依赖未声明的 `typescript-eslint` 聚合包；若验证失败，以命令输出为准继续修复。

## Android 构建

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

签名资产位于项目外目录；不要把 keystore 或 release signing 配置写入仓库。具体路径与能力边界见 `../README.md`。
