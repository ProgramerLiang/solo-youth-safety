import { SummaryCard } from '../components/SummaryCard'
import { trackingIntervalOptions } from '../tracking'

export function getBackendModeLabel(isUsingLocalBackend) {
  return isUsingLocalBackend ? '本地后端' : '远端后端'
}

function TrackingGuardSection({
  buildTrackingStatusHint,
  formatPanelTime,
  trackingBusy,
  trackingSnapshot,
  onRunTrackingNow,
  onToggleTracking,
  onTrackingIntervalChange,
}) {
  return (
    <section className="md-section-card md-tracking-section">
      <div className="md-section-head">
        <h3>轨迹守护</h3>
        <span className={`md-chip ${trackingSnapshot.enabled ? '' : 'subtle'}`}>
          {trackingSnapshot.enabled ? '已开启' : '已关闭'}
        </span>
      </div>
      <p className="md-section-hint">开启后会按设定周期采样当前位置并写入轨迹；若写入失败，将进入本地队列并在稍后自动补发。</p>
      <div className="md-summary-grid">
        <div className="md-kv-item">
          <span>采样周期</span>
          <strong>{trackingSnapshot.intervalSeconds} 秒</strong>
        </div>
        <div className="md-kv-item">
          <span>待补发</span>
          <strong>{trackingSnapshot.pendingCount} 条</strong>
        </div>
        <div className="md-kv-item">
          <span>最近采样</span>
          <strong>{formatPanelTime(trackingSnapshot.lastCapturedAt)}</strong>
        </div>
        <div className="md-kv-item">
          <span>最近同步</span>
          <strong>{formatPanelTime(trackingSnapshot.lastSyncedAt)}</strong>
        </div>
      </div>
      <label className="md-inline-field">
        <span>自动采样周期</span>
        <select value={trackingSnapshot.intervalSeconds} onChange={onTrackingIntervalChange}>
          {trackingIntervalOptions.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds} 秒
            </option>
          ))}
        </select>
      </label>
      <div className="md-row-actions">
        <button type="button" className="md-btn" onClick={onToggleTracking} disabled={trackingBusy}>
          {trackingSnapshot.enabled ? '停止周期轨迹' : '开启周期轨迹'}
        </button>
        <button
          type="button"
          className="md-btn tonal"
          onClick={onRunTrackingNow}
          disabled={trackingBusy}
        >
          {trackingBusy ? '轨迹处理中...' : '立即采样并补发'}
        </button>
      </div>
      <div className="md-helper">
        <p>{buildTrackingStatusHint(trackingSnapshot)}</p>
      </div>
    </section>
  )
}

export function TrackingPage({
  buildTrackingStatusHint,
  formatLocationText,
  formatPanelTime,
  healthText,
  isUsingLocalBackend,
  latestLocation,
  localPanel,
  locationAccuracy,
  locationFreshness,
  locationRefreshing,
  permissionText,
  showToolsPage,
  trackingBusy,
  trackingSnapshot,
  onCheckHealth,
  onNavigate,
  onRefreshLocation,
  onRunTrackingNow,
  onToggleTracking,
  onTrackingIntervalChange,
}) {
  return (
    <div className="md-page-stack">
      <section className="md-summary-grid">
        <SummaryCard
          label="守护状态"
          value={trackingSnapshot.enabled ? '已开启' : '已关闭'}
          hint={buildTrackingStatusHint(trackingSnapshot)}
        />
        <SummaryCard
          label="采样周期"
          value={`${trackingSnapshot.intervalSeconds} 秒`}
          hint="前台存活期间自动采样"
        />
        <SummaryCard
          label="待补发"
          value={`${trackingSnapshot.pendingCount} 条`}
          hint={trackingSnapshot.nextRetryAt ? `下一次 ${formatPanelTime(trackingSnapshot.nextRetryAt)}` : '当前无积压'}
        />
        <SummaryCard
          label="最近采样"
          value={formatPanelTime(trackingSnapshot.lastCapturedAt)}
          hint="用于判断守护是否在工作"
        />
        <SummaryCard
          label="最近同步"
          value={formatPanelTime(trackingSnapshot.lastSyncedAt)}
          hint="写入后端成功时间"
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
            <h3>轨迹守护控制台</h3>
            <p className="md-section-hint">统一为总览页相同的 dashboard 卡片风格，核心操作与运行状态分区展示。</p>
          </div>
          <span className={`md-chip ${isUsingLocalBackend ? 'subtle' : ''}`}>
            {getBackendModeLabel(isUsingLocalBackend)}
          </span>
        </div>
      </section>

      <div className="md-dashboard-grid">
        <TrackingGuardSection
          buildTrackingStatusHint={buildTrackingStatusHint}
          formatPanelTime={formatPanelTime}
          trackingBusy={trackingBusy}
          trackingSnapshot={trackingSnapshot}
          onRunTrackingNow={onRunTrackingNow}
          onToggleTracking={onToggleTracking}
          onTrackingIntervalChange={onTrackingIntervalChange}
        />

        <section className="md-section-card md-dashboard-side-card">
          <div className="md-section-head">
            <h3>设备与运行状态</h3>
            <span className="md-chip subtle">实时信息</span>
          </div>
          <div className="md-kv-list">
            <div className="md-kv-item">
              <span>定位状态</span>
              <strong>{permissionText}</strong>
            </div>
            <div className="md-kv-item">
              <span>后端健康</span>
              <strong>{healthText}</strong>
            </div>
            <div className="md-kv-item">
              <span>当前位置</span>
              <strong>{formatLocationText(latestLocation)}</strong>
            </div>
            <div className="md-kv-item">
              <span>位置新鲜度</span>
              <strong>{locationFreshness.label}</strong>
            </div>
            <div className="md-kv-item">
              <span>最近刷新</span>
              <strong>{locationFreshness.updatedAt}</strong>
            </div>
            <div className="md-kv-item">
              <span>本地数据</span>
              <strong>{localPanel ? `SOS ${localPanel.sosCount} / 轨迹 ${localPanel.trackingCount}` : '未启用'}</strong>
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
            <button type="button" className="md-btn tonal" onClick={onCheckHealth}>
              检查后端
            </button>
            <button type="button" className="md-btn tonal" onClick={() => onNavigate('overview')}>
              返回总览
            </button>
          </div>
          {showToolsPage && (
            <div className="md-helper">
              <p>需要看本地快照、导入导出或 mock 工具时，请进入“工具”页面。</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
