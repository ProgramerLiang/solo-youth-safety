# MVP 开发任务清单

更新时间：2026-03-22

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
- [x] 完成自适应多页面布局重组（总览 / 主题 / 配置 / 联系人 / SOS / 历史 / 工具）
- [x] 完成 Material 动态主题（壁纸吸色 / 预设 / 自定义调色板）
- [x] 完成开发者模式隐藏入口（五连击版本号显示工具页）
- [x] 完成远端后端 SQLite 持久化
- [x] 完成 release 签名配置（签名资产与备份均在项目外）
- [x] 完成 debug / release / AAB 构建链路

## P0（下一阶段必须）
- [x] 正式联系人管理 UI（新增 / 编辑 / 删除）
- [x] SOS 历史记录页与详情页
- [x] 用户 / 设备标识持久化（移除硬编码）
- [x] 本地持久化升级（Android `localStorage` → Capacitor Preferences）
- [x] 远端后端数据库持久化（FastAPI → SQLite）
- [x] Release APK / AAB 与签名配置
- [ ] 前后端基础自动化测试与 CI
- [ ] 位置新鲜度判断与提示

## P1（应做）
- [ ] 位置刷新入口与状态展示
- [ ] 周期轨迹写入 / 弱网补偿策略
- [ ] 风险区域提示
- [ ] 安全路线推荐（占位版）
- [ ] 报警事件历史回放（地图 / 时间轴）
- [ ] 配置导入字段级差异标记（新增 / 删除 / 修改）

## P2（可选）
- [ ] AI 情绪陪伴
- [ ] 伪装语音辅助
- [ ] 偷拍检测
- [ ] 深度安全导航能力

## 参考文档
- `docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`
- `docs/mvp/ANDROID_TEST_CHECKLIST.md`
- `frontend/README.md`
- `backend/README.md`
