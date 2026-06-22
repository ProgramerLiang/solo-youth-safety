import { SummaryCard } from '../components/SummaryCard'

function ToolsSummary({ formatTime, localPanel, storageDriver }) {
  return (
    <section className="md-summary-grid">
      <SummaryCard label="存储驱动" value={storageDriver} hint="当前本地持久化实现" />
      <SummaryCard label="配置状态" value={localPanel?.hasConfig ? '已保存' : '未保存'} hint="基于本地面板快照" />
      <SummaryCard label="联系人" value={`${localPanel?.contactsCount || 0} 条`} hint="可用于通知配置快捷填入" />
      <SummaryCard label="轨迹点" value={`${localPanel?.trackingCount || 0} 条`} hint="用于守护与回放验收" />
      <SummaryCard
        label="SOS 事件"
        value={`${localPanel?.sosCount || 0} 条`}
        hint={localPanel?.latestSos ? formatTime(localPanel.latestSos) : '暂无记录'}
      />
      <SummaryCard
        label="工具模式"
        value={localPanel ? '本地后端可用' : '不可用'}
        hint={localPanel ? `当前用户 ${localPanel.userId}` : '仅在本地后端模式展示完整面板'}
      />
    </section>
  )
}

function ToolsIntroCard({ storageDriver }) {
  return (
    <section className="md-section-card md-dashboard-intro-card">
      <div className="md-section-head">
        <div>
          <h3>开发者自检页</h3>
          <p className="md-section-hint">工具页也收敛到同一套 dashboard 体系，本地后端面板、Mock 操作与快照预览分区展示。</p>
        </div>
        <span className="md-chip subtle">Debug / 验收辅助</span>
      </div>
      <p className="md-section-hint">当前持久化驱动：{storageDriver}</p>
    </section>
  )
}

function LocalPanelStats({ localPanel }) {
  const stats = [
    ['配置', localPanel.hasConfig ? '已保存' : '未保存'],
    ['SOS 记录', localPanel.sosCount],
    ['联系人', localPanel.contactsCount],
    ['轨迹点', localPanel.trackingCount],
  ]

  return (
    <div className="md-local-panel-grid">
      {stats.map(([label, value]) => (
        <div key={label} className="md-stat-card">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  )
}

function LocalPanelActions({
  localPanel,
  onAddMockContact,
  onAddMockTracking,
  onClearLocalPanel,
  onExportLocalBundle,
  onImportLocalBundleClick,
  onInspectContacts,
  onInspectTracking,
  onRefreshLocalPanel,
}) {
  const actions = [
    ['刷新面板', () => onRefreshLocalPanel(localPanel.userId)],
    ['导出本地快照', onExportLocalBundle],
    ['导入本地快照', onImportLocalBundleClick],
    ['添加模拟联系人', onAddMockContact],
    ['写入模拟轨迹', onAddMockTracking],
    ['刷新联系人快照', onInspectContacts],
    ['刷新轨迹快照', onInspectTracking],
    ['清空本地数据', onClearLocalPanel],
  ]

  return (
    <div className="md-row-actions">
      {actions.map(([label, onClick]) => (
        <button key={label} type="button" className="md-btn tonal" onClick={onClick}>
          {label}
        </button>
      ))}
    </div>
  )
}

function LocalPanelSection(props) {
  const { formatTime, localPanel } = props
  if (!localPanel) {
    return (
      <section className="md-section-card md-dashboard-primary-card">
        <div className="md-section-head">
          <h3>本地后端数据面板</h3>
          <span className="md-chip subtle">不可用</span>
        </div>
        <p className="md-data-empty">当前不在本地后端模式，工具页无可展示的本地数据面板。</p>
      </section>
    )
  }

  return (
    <section className="md-local-panel md-section-card md-dashboard-primary-card">
      <div className="md-local-panel-header">
        <h3>本地后端数据面板</h3>
        <span className="md-chip">当前用户 {localPanel.userId}</span>
      </div>
      <LocalPanelStats localPanel={localPanel} />
      <p className="md-local-panel-time">最近 SOS：{formatTime(localPanel.latestSos)}</p>
      <p className="md-local-panel-note">建议仅在测试 / 验收时使用下面这些工具按钮。</p>
      <LocalPanelActions {...props} />
    </section>
  )
}

function ToolsGuideSection({ contactsPreview, trackingPreview }) {
  return (
    <section className="md-section-card md-dashboard-side-card">
      <div className="md-section-head">
        <h3>验收快捷操作</h3>
        <span className="md-chip subtle">建议按顺序执行</span>
      </div>
      <ul className="md-bullet-list">
        <li>先刷新面板，确认当前用户、配置和计数是否正确。</li>
        <li>用模拟联系人 / 模拟轨迹快速构造验收数据。</li>
        <li>导出快照后可做回归验证，再导入恢复现场。</li>
        <li>清空本地数据前请确认当前快照已备份。</li>
      </ul>
      <div className="md-kv-list">
        <div className="md-kv-item">
          <span>联系人快照</span>
          <strong>{contactsPreview ? `${contactsPreview.count} 条` : '未加载'}</strong>
        </div>
        <div className="md-kv-item">
          <span>轨迹快照</span>
          <strong>{trackingPreview ? `${trackingPreview.count} 条` : '未加载'}</strong>
        </div>
      </div>
    </section>
  )
}

function SnapshotCard({ count, emptyText, items, renderItem, title }) {
  return (
    <article className="md-data-card">
      <div className="md-data-card-header">
        <h3>{title}</h3>
        <span className="md-chip">{count} 条</span>
      </div>
      {items.length > 0 ? (
        <ul className="md-data-list">
          {items.map(renderItem)}
        </ul>
      ) : (
        <p className="md-data-empty">{emptyText}</p>
      )}
    </article>
  )
}

function SnapshotPreviewSection({ contactsPreview, formatTime, trackingPreview }) {
  if (!contactsPreview && !trackingPreview) {
    return null
  }

  return (
    <section className="md-section-card md-history-section">
      <div className="md-data-card-header">
        <div>
          <h2>本地快照预览</h2>
          <p className="md-section-hint">联系人与轨迹预览统一收纳到同一张结果卡，便于完成工具页验收。</p>
        </div>
        <span className="md-chip">预览区</span>
      </div>
      <div className="md-preview-section">
        {contactsPreview ? (
          <SnapshotCard
            title="联系人快照"
            count={contactsPreview.count}
            items={contactsPreview.items}
            emptyText="暂无联系人数据"
            renderItem={(item) => (
              <li key={item.id || `${item.name}-${item.phone}`} className="md-data-list-item">
                <strong>{item.name}</strong>
                <span>{item.phone}</span>
              </li>
            )}
          />
        ) : null}
        {trackingPreview ? (
          <SnapshotCard
            title="最近 1 小时轨迹"
            count={trackingPreview.count}
            items={trackingPreview.items}
            emptyText="最近 1 小时暂无轨迹点"
            renderItem={(point) => (
              <li key={`${point.timestamp}-${point.lat}-${point.lng}`} className="md-data-list-item">
                <strong>({point.lat}, {point.lng})</strong>
                <span>{formatTime(point.timestamp)}</span>
              </li>
            )}
          />
        ) : null}
      </div>
    </section>
  )
}

export function ToolsPage(props) {
  const { contactsPreview, formatTime, localPanel, storageDriver, trackingPreview } = props

  return (
    <div className="md-page-stack">
      <ToolsSummary formatTime={formatTime} localPanel={localPanel} storageDriver={storageDriver} />
      <ToolsIntroCard storageDriver={storageDriver} />
      <div className="md-dashboard-grid">
        <LocalPanelSection {...props} />
        <ToolsGuideSection contactsPreview={contactsPreview} trackingPreview={trackingPreview} />
      </div>
      <SnapshotPreviewSection
        contactsPreview={contactsPreview}
        formatTime={formatTime}
        trackingPreview={trackingPreview}
      />
    </div>
  )
}
