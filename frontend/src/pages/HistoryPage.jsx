import { SummaryCard } from '../components/SummaryCard'

export function HistoryPage({
  formatLocationAccuracy,
  formatPanelTime,
  onRefreshSosHistory,
  selectedSosEvent,
  setSelectedSosId,
  sosHistory,
  summarizeNotifications,
}) {
  return (
    <div className="md-page-stack">
      <section className="md-summary-grid">
        <SummaryCard label="历史总数" value={`${sosHistory.length} 条`} hint="按时间倒序展示" />
        <SummaryCard
          label="当前选中"
          value={selectedSosEvent ? '已选择事件' : '未选择'}
          hint={selectedSosEvent ? formatPanelTime(selectedSosEvent.timestamp) : '点击左侧记录查看详情'}
        />
        <SummaryCard
          label="触发类型"
          value={selectedSosEvent ? (selectedSosEvent.triggerType === 'manual' ? '手动' : '自动') : '暂无'}
          hint="用于回溯触发来源"
        />
        <SummaryCard
          label="通知条数"
          value={selectedSosEvent ? `${selectedSosEvent.notifications.length} 条` : '0 条'}
          hint="含电话 / 短信执行结果"
        />
      </section>

      <section className="md-section-card md-dashboard-intro-card md-history-section">
        <div className="md-data-card-header">
          <div>
            <h2>SOS 历史记录</h2>
            <p className="md-section-hint">列表与详情拆分展示，风格统一到当前 dashboard 页面体系。</p>
          </div>
          <span className="md-chip">最近 {sosHistory.length} 条</span>
        </div>
        <div className="md-row-actions">
          <button type="button" className="md-btn tonal" onClick={onRefreshSosHistory}>
            刷新历史
          </button>
        </div>

        {sosHistory.length > 0 ? (
          <div className="md-history-layout">
            <ul className="md-history-list">
              {sosHistory.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    className={`md-history-item ${selectedSosEvent?.id === event.id ? 'active' : ''}`}
                    onClick={() => setSelectedSosId(event.id)}
                  >
                    <strong>{formatPanelTime(event.timestamp)}</strong>
                    <span>{event.triggerType === 'manual' ? '手动触发' : '自动触发'}</span>
                    <span>{summarizeNotifications(event.notifications)}</span>
                  </button>
                </li>
              ))}
            </ul>

            {selectedSosEvent && (
              <article className="md-history-detail">
                <div className="md-history-detail-grid">
                  <p>
                    <strong>事件 ID：</strong>
                    {selectedSosEvent.id}
                  </p>
                  <p>
                    <strong>触发时间：</strong>
                    {formatPanelTime(selectedSosEvent.timestamp)}
                  </p>
                  <p>
                    <strong>触发方式：</strong>
                    {selectedSosEvent.triggerType === 'manual' ? '手动' : '自动'}
                  </p>
                  <p>
                    <strong>设备：</strong>
                    {selectedSosEvent.deviceId}
                  </p>
                  <p>
                    <strong>位置：</strong>
                    ({selectedSosEvent.location.lat}, {selectedSosEvent.location.lng})
                  </p>
                  <p>
                    <strong>精度：</strong>
                    {formatLocationAccuracy(selectedSosEvent.location)}
                  </p>
                </div>

                <h3 className="md-history-subtitle">通知结果</h3>
                {selectedSosEvent.notifications.length > 0 ? (
                  <ul className="md-data-list">
                    {selectedSosEvent.notifications.map((item, index) => (
                      <li
                        key={`${selectedSosEvent.id}-${item.channel}-${index}`}
                        className="md-data-list-item"
                      >
                        <strong>
                          {item.channel.toUpperCase()} / {item.status}
                        </strong>
                        <span>{item.destination || '未设置号码'}</span>
                        <span>{item.detail}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="md-data-empty">该事件暂无通知详情。</p>
                )}
              </article>
            )}
          </div>
        ) : (
          <p className="md-data-empty">当前用户暂无 SOS 历史记录，触发一次 SOS 后会在这里展示。</p>
        )}
      </section>
    </div>
  )
}
