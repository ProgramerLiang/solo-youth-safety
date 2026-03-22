# 独行青年安全守护应用

## 项目简介
本项目面向独行青年的人身安全场景，当前已完成一版可运行的 Android MVP，核心方向包括：
- 一键 SOS 报警
- 紧急联系人通知
- 位置记录与轨迹查询
- Android APK 独立运行（内置本地后端模式）

## 当前阶段
当前项目已完成 **MVP 演示闭环**：
- `frontend`：React + Vite
- `backend`：FastAPI
- `android`：Capacitor 6
- 已支持 debug APK 构建与安装验证
- 已支持 APK 内本地后端模式，无需手机内运行 Python 服务

## 当前能力概览
- 首次启动自动申请定位权限
- 配置电话号码 / 短信号码（均可留空）
- 自定义短信模板与变量预览
- 正式联系人管理（新增 / 编辑 / 删除 / 一键填入号码）
- SOS 5 秒倒计时与取消
- Android 原生拨号 / 短信拉起
- 本地数据面板、联系人 / 轨迹预览
- 本地快照导出 / 导入

## 目录说明
- `frontend/`：React + Vite + Capacitor Android 前端
- `backend/`：FastAPI 后端服务
- `docs/api/`：接口说明
- `docs/mvp/TASKS.md`：当前任务清单
- `docs/mvp/ANDROID_TEST_CHECKLIST.md`：Android 实机测试清单
- `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`：项目现状评估与下一阶段路线图

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

### Android debug APK
```bash
cd frontend
npm run build
npm run android:sync
npm run android:apk
```

APK 输出路径：
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`

## 下一阶段重点
详见：`docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`

当前最优先的方向是：
1. 正式联系人管理 UI
2. SOS 历史记录页与详情
3. 用户 / 设备标识持久化
4. 本地与远端持久化升级
5. Release APK / 签名 / 调试功能隔离
6. 测试与 CI
