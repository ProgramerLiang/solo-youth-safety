# 独行青年安全守护应用

## 项目简介
本项目面向独行青年的人身安全场景，当前已完成一版可运行的 Android MVP，核心方向包括：
- 一键 SOS 报警
- 紧急联系人通知
- 位置记录与轨迹查询
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
- 顶部页面跳转条 + 左上角按钮 / 侧滑抽屉导航已接入
- 正式联系人管理（新增 / 编辑 / 删除 / 一键填入号码）
- SOS 5 秒倒计时与取消
- SOS 历史记录与通知详情查看
- Android 原生直拨电话 / 直接发送短信（需授予 `CALL_PHONE` / `SEND_SMS`）
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
- `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`：项目现状评估与下一阶段路线图
- `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`：从当前 Android MVP 向原始愿景能力靠拢的总路线图
- `docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`：原始承诺与当前实现状态对照表

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
详见：
- `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`（统一总路线图，含“建议立即做 / 建议延后 / 不建议近期做”分组）
- `docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`（原始承诺与当前实现状态对照）
- `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`（文档与代码已确认不一致点）
- `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`
- `docs/mvp/PROJECT_IMPROVEMENTS_REVIEW.md`
- `docs/mvp/TASKS.md`

当前这一轮已确认先做文档同步，再进入实现；其中“前后端基础自动化测试与 CI”基础版已接入，接下来最优先的方向是：
1. 远端身份 / 鉴权基线与 CORS 收口
2. 继续拆分大文件、整理模块边界
3. 统一版本与配置入口
4. 收敛本地后端与远端后端 API 契约一致性
