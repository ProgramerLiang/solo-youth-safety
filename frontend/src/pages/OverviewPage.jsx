import { SummaryCard } from '../components/SummaryCard'

export function OverviewPage({
  contactsList,
  form,
  latestLocation,
  locationAccuracy,
  locationFreshness,
  locationRefreshing,
  onboardingDone,
  pages,
  sosHistory,
  trackingSnapshot,
  onNavigate,
  onRefreshLocation,
  formatLocationText,
  formatPanelTime,
  buildTrackingStatusHint,
}) {
  const latestSosEvent = sosHistory[0] || null

  return (
    <div className="md-page-stack">
      <section className="md-summary-grid">
        <SummaryCard
          label="引导状态"
          value={onboardingDone ? '已完成' : '待完成'}
          hint={onboardingDone ? '可直接进入 SOS' : '建议先完成配置'}
        />
        <SummaryCard
          label="通知通道"
          value={`${form.callNumber.trim() ? 1 : 0}/${form.smsNumber.trim() ? 1 : 0} 已配置`}
          hint="电话 / 短信"
        />
        <SummaryCard
          label="联系人"
          value={`${contactsList.length} 人`}
          hint={contactsList.length > 0 ? '可一键填入配置' : '建议至少维护 1 人'}
        />
        <SummaryCard
          label="SOS 历史"
          value={`${sosHistory.length} 条`}
          hint={latestSosEvent ? formatPanelTime(latestSosEvent.timestamp) : '暂无事件'}
        />
        <SummaryCard
          label="轨迹守护"
          value={trackingSnapshot.enabled ? '已开启' : '已关闭'}
          hint={buildTrackingStatusHint(trackingSnapshot)}
        />
        <SummaryCard
          label="定位精度"
          value={locationAccuracy.label}
          hint={locationAccuracy.hint}
        />
      </section>

      <section className="md-section-card md-dashboard-intro-card">
        <div className="md-section-head">
          <div>
            <h3>功能中枢</h3>
            <p className="md-section-hint">以更强的卡片化方式组织核心入口，减少长列表感。</p>
          </div>
          <span className="md-chip">分页面使用</span>
        </div>
        <div className="md-dashboard-feature-grid">
          {pages
            .filter((page) => page.id !== 'overview')
            .map((page) => (
              <button
                key={page.id}
                type="button"
                className="md-dashboard-feature-card"
                onClick={() => onNavigate(page.id)}
              >
                <span className="md-dashboard-feature-kicker">{page.label}</span>
                <strong>{page.title}</strong>
                <p>{page.description}</p>
              </button>
            ))}
        </div>
      </section>

      <div className="md-dashboard-grid">
        <section className="md-section-card md-dashboard-primary-card">
          <div className="md-section-head">
            <div>
              <h3>当前位置与行动建议</h3>
              <p className="md-section-hint">参考图的首屏主卡片结构，保留当前功能，但把信息层级做得更清晰。</p>
            </div>
            <span className="md-chip subtle">进入 SOS 前建议先看这里</span>
          </div>
          <div className="md-dashboard-location-panel">
            <div className="md-dashboard-location-main">
              <span className="md-dashboard-eyebrow">当前位置</span>
              <strong>{formatLocationText(latestLocation)}</strong>
              <p>{locationFreshness.label} · {locationAccuracy.hint}</p>
            </div>
            <div className="md-dashboard-location-meta">
              <div className="md-kv-item">
                <span>最近 SOS</span>
                <strong>{latestSosEvent ? formatPanelTime(latestSosEvent.timestamp) : '暂无'}</strong>
              </div>
              <div className="md-kv-item">
                <span>轨迹守护</span>
                <strong>{trackingSnapshot.enabled ? '已开启' : '已关闭'}</strong>
              </div>
              <div className="md-kv-item">
                <span>联系人</span>
                <strong>{contactsList.length > 0 ? `${contactsList.length} 人` : '待添加'}</strong>
              </div>
            </div>
          </div>
          <div className="md-row-actions">
            <button
              type="button"
              className="md-btn tonal"
              onClick={onRefreshLocation}
              disabled={locationRefreshing}
            >
              {locationRefreshing ? '刷新位置中...' : '刷新当前位置'}
            </button>
            <button type="button" className="md-btn" onClick={() => onNavigate('sos')}>
              前往 SOS
            </button>
            <button type="button" className="md-btn tonal" onClick={() => onNavigate('tracking')}>
              前往守护页
            </button>
          </div>
        </section>

        <div className="md-dashboard-side-stack">
          <section className="md-section-card md-dashboard-side-card">
            <div className="md-section-head">
              <h3>主流程入口</h3>
              <span className="md-chip subtle">轻量导航</span>
            </div>
            <div className="md-kv-list">
              <div className="md-kv-item">
                <span>通知配置</span>
                <strong>{form.callNumber.trim() || form.smsNumber.trim() ? '已填写' : '待填写'}</strong>
              </div>
              <div className="md-kv-item">
                <span>联系人</span>
                <strong>{contactsList.length > 0 ? `已维护 ${contactsList.length} 人` : '待添加'}</strong>
              </div>
              <div className="md-kv-item">
                <span>守护状态</span>
                <strong>{trackingSnapshot.enabled ? '运行中' : '未开启'}</strong>
              </div>
              <div className="md-kv-item">
                <span>历史记录</span>
                <strong>{sosHistory.length > 0 ? `最近 ${sosHistory.length} 条` : '暂无记录'}</strong>
              </div>
            </div>
            <div className="md-row-actions">
              <button type="button" className="md-btn tonal" onClick={() => onNavigate('config')}>
                通知配置
              </button>
              <button type="button" className="md-btn tonal" onClick={() => onNavigate('contacts')}>
                联系人管理
              </button>
              <button type="button" className="md-btn tonal" onClick={() => onNavigate('history')}>
                查看历史
              </button>
            </div>
          </section>

          <section className="md-section-card md-dashboard-side-card">
            <div className="md-section-head">
              <h3>守护摘要</h3>
              <span className="md-chip subtle">Dashboard</span>
            </div>
            <div className="md-dashboard-mini-grid">
              <div className="md-dashboard-mini-card">
                <span>位置新鲜度</span>
                <strong>{locationFreshness.label}</strong>
              </div>
              <div className="md-dashboard-mini-card">
                <span>定位精度</span>
                <strong>{locationAccuracy.label}</strong>
              </div>
              <div className="md-dashboard-mini-card">
                <span>待补发</span>
                <strong>{trackingSnapshot.pendingCount} 条</strong>
              </div>
              <div className="md-dashboard-mini-card">
                <span>SOS 历史</span>
                <strong>{sosHistory.length} 条</strong>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
