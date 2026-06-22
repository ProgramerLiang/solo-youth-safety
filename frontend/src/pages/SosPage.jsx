import { SummaryCard } from '../components/SummaryCard'

export function SosPage({
  arming,
  countdown,
  historyCount,
  latestLocation,
  latestSosEvent,
  loadingInit,
  locationAccuracy,
  locationFreshness,
  locationRefreshing,
  onboardingDone,
  smsNumber,
  callNumber,
  templateLength,
  formatPanelTime,
  formatLocationText,
  onArmSos,
  onCancelSos,
  onNavigate,
  onRefreshLocation,
}) {
  return (
    <div className="md-page-stack">
      {!onboardingDone && <div className="md-banner">建议先在“通知配置”页面完成保存，再进入 SOS 流程。</div>}
      {locationFreshness.banner && <div className="md-banner">{locationFreshness.banner}</div>}
      {locationAccuracy.banner && <div className="md-banner">{locationAccuracy.banner}</div>}

      <section className="md-summary-grid">
        <SummaryCard
          label="电话通道"
          value={callNumber.trim() ? '已配置' : '未配置'}
          hint={callNumber.trim() || '留空时自动跳过'}
        />
        <SummaryCard
          label="短信通道"
          value={smsNumber.trim() ? '已配置' : '未配置'}
          hint={smsNumber.trim() || '留空时自动跳过'}
        />
        <SummaryCard label="模板状态" value={`${templateLength} 字符`} hint="支持变量占位符" />
        <SummaryCard
          label="历史记录"
          value={`${historyCount} 条`}
          hint={latestSosEvent ? formatPanelTime(latestSosEvent.timestamp) : '暂无历史'}
        />
        <SummaryCard
          label="位置新鲜度"
          value={locationFreshness.label}
          hint={locationFreshness.hint}
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
            <h3>SOS 快速触发</h3>
            <p className="md-section-hint">沿用统一 dashboard 结构，主操作卡突出，位置确认与说明放到辅助卡。</p>
          </div>
          <span className="md-chip">5 秒倒计时</span>
        </div>
      </section>

      <div className="md-dashboard-grid">
        <section className="md-sos-panel md-section-card md-dashboard-primary-card">
          <div className="md-section-head">
            <h2>SOS 快速操作</h2>
            <span className="md-chip">5 秒倒计时</span>
          </div>
          <p>触发后会先写入后端事件，再尝试直接发送短信并直接发起拨号。</p>
          {!arming ? (
            <button
              type="button"
              className="md-btn danger"
              onClick={onArmSos}
              disabled={loadingInit}
            >
              触发 SOS（倒计时 5 秒）
            </button>
          ) : (
            <button type="button" className="md-btn" onClick={onCancelSos}>
              取消 SOS（剩余 {countdown}s）
            </button>
          )}
        </section>

        <section className="md-section-card md-dashboard-side-card">
          <div className="md-section-head">
            <h3>位置确认与触发说明</h3>
            <span className="md-chip subtle">SOS 前建议先确认位置</span>
          </div>

          <div className="md-kv-list">
            <div className="md-kv-item">
              <span>当前位置</span>
              <strong>{formatLocationText(latestLocation)}</strong>
            </div>
            <div className="md-kv-item">
              <span>位置新鲜度</span>
              <strong>{locationFreshness.label}</strong>
            </div>
            <div className="md-kv-item">
              <span>定位精度</span>
              <strong>{locationAccuracy.hint}</strong>
            </div>
            <div className="md-kv-item">
              <span>最近刷新</span>
              <strong>{locationFreshness.updatedAt}</strong>
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
            <button type="button" className="md-btn tonal" onClick={() => onNavigate('config')}>
              检查配置
            </button>
            <button type="button" className="md-btn tonal" onClick={() => onNavigate('history')}>
              查看历史
            </button>
          </div>

          <ul className="md-bullet-list">
            <li>电话与短信号码都可留空，空值会显示为 skipped。</li>
            <li>首次触发原生动作时会按需申请短信 / 电话权限。</li>
            <li>手动刷新和 SOS 前刷新会进行 2~3 次采样，并自动采用精度最佳结果。</li>
            <li>短信内容按当前模板与实时位置变量渲染，并直接发送。</li>
            <li>倒计时结束时若位置缺失或偏旧，会优先尝试刷新当前位置。</li>
            <li>触发完成后，可前往“历史”页面查看事件详情。</li>
          </ul>

          {latestSosEvent ? (
            <div className="md-kv-list">
              <div className="md-kv-item">
                <span>最近事件</span>
                <strong>{formatPanelTime(latestSosEvent.timestamp)}</strong>
              </div>
              <div className="md-kv-item">
                <span>位置</span>
                <strong>
                  {latestSosEvent.location.lat}, {latestSosEvent.location.lng}
                </strong>
              </div>
            </div>
          ) : (
            <p className="md-data-empty">当前还没有 SOS 记录，触发一次后即可在历史页查看。</p>
          )}
        </section>
      </div>
    </div>
  )
}
