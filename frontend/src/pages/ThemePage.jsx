import { SummaryCard } from '../components/SummaryCard'
import { presetPalettes } from '../theme'

function getThemeModeLabel(mode) {
  if (mode === 'dynamic') {
    return '壁纸吸色'
  }
  if (mode === 'custom') {
    return '自定义'
  }
  return '预设'
}

function ThemeSummary({ currentAppVersion, dynamicSupported, themeState }) {
  return (
    <section className="md-summary-grid">
      <SummaryCard label="当前主题" value={themeState.label} hint={`主色 ${themeState.seedColor}`} />
      <SummaryCard
        label="壁纸吸色"
        value={dynamicSupported ? '已支持' : '当前设备不支持'}
        hint={dynamicSupported ? themeState.dynamicInfo.source : 'Android 12+ 可用'}
      />
      <SummaryCard label="APK 版本" value={currentAppVersion} hint="从此版本开始使用 0.x.x 迭代" />
      <SummaryCard
        label="当前模式"
        value={getThemeModeLabel(themeState.preferences.mode)}
        hint="修改后立即生效并持久化"
      />
    </section>
  )
}

function ThemeIntroCard() {
  return (
    <section className="md-section-card md-dashboard-intro-card">
      <div className="md-section-head">
        <div>
          <h3>主题与视觉设置</h3>
          <p className="md-section-hint">主题页也统一为 dashboard 结构，模式选择、调色板与实时预览分层展示。</p>
        </div>
        <span className="md-chip">Material Design</span>
      </div>
    </section>
  )
}

function ThemeModeButtons({ dynamicSupported, mode, onThemeModeChange }) {
  const options = [
    ['dynamic', '壁纸吸色', dynamicSupported ? '默认启用，跟随系统 Material You' : '当前设备不支持'],
    ['preset', '预设调色板', '提供多组稳定配色，适合统一演示风格'],
    ['custom', '自定义调色板', '选择自己的主色，立即重算 Material 色阶'],
  ]

  return (
    <div className="md-theme-mode-grid">
      {options.map(([id, title, desc]) => (
        <button
          key={id}
          type="button"
          className={`md-theme-option ${mode === id ? 'active' : ''}`}
          onClick={() => onThemeModeChange(id)}
          disabled={id === 'dynamic' && !dynamicSupported}
        >
          <strong>{title}</strong>
          <span>{desc}</span>
        </button>
      ))}
    </div>
  )
}

function ThemePaletteSection({ customSeed, presetId, onCustomSeedChange, onPresetChange }) {
  return (
    <>
      <div className="md-section-head">
        <h3>调色板选择</h3>
        <span className="md-chip subtle">实时预览</span>
      </div>
      <div className="md-theme-palette-grid">
        {presetPalettes.map((palette) => (
          <button
            key={palette.id}
            type="button"
            className={`md-palette-card ${presetId === palette.id ? 'active' : ''}`}
            onClick={() => onPresetChange(palette.id)}
          >
            <span className="md-color-dot" style={{ backgroundColor: palette.seed }} aria-hidden="true" />
            <strong>{palette.label}</strong>
            <span>{palette.seed}</span>
          </button>
        ))}
      </div>
      <label htmlFor="customSeed" className="md-theme-custom-label">自定义主色</label>
      <div className="md-theme-custom-row">
        <input
          id="customSeed"
          type="color"
          value={customSeed}
          onChange={onCustomSeedChange}
          className="md-color-input"
        />
        <div className="md-readonly-field">
          <span>当前自定义颜色</span>
          <strong>{customSeed}</strong>
        </div>
      </div>
    </>
  )
}

function ThemePreviewPanel({ currentAppVersion, themeState }) {
  const blocks = [
    ['Primary', themeState.palette.primary, themeState.palette.onPrimary, themeState.palette.primary, themeState.palette.onPrimary],
    ['Primary Container', themeState.palette.primaryContainer, themeState.palette.onPrimaryContainer, themeState.palette.primaryContainer, themeState.palette.onPrimaryContainer],
    ['Surface', themeState.palette.surface, themeState.palette.onSurface, themeState.palette.surface, themeState.palette.onSurfaceVariant],
    ['Surface Container', themeState.palette.surfaceContainer, themeState.palette.onSurface, themeState.palette.surfaceContainer, themeState.palette.onSurfaceVariant],
  ]

  return (
    <section className="md-section-card md-theme-preview-card md-dashboard-side-card">
      <div className="md-section-head">
        <h3>当前主题预览</h3>
        <span className="md-chip subtle">v{currentAppVersion}</span>
      </div>
      <div className="md-theme-preview-grid">
        {blocks.map(([label, background, color, value, labelColor]) => (
          <div key={label} className="md-theme-preview-block" style={{ backgroundColor: background, color }}>
            <span style={{ color: labelColor }}>{label}</span>
            <strong style={{ color }}>{value}</strong>
          </div>
        ))}
      </div>
      <div className="md-kv-list">
        <div className="md-kv-item">
          <span>动态主题来源</span>
          <strong>{themeState.dynamicInfo.source}</strong>
        </div>
        <div className="md-kv-item">
          <span>模式持久化</span>
          <strong>已开启</strong>
        </div>
      </div>
    </section>
  )
}

export function ThemePage({
  currentAppVersion,
  themeState,
  onCustomSeedChange,
  onPresetChange,
  onThemeModeChange,
}) {
  const dynamicSupported = themeState.dynamicInfo.supported

  return (
    <div className="md-page-stack">
      <ThemeSummary
        currentAppVersion={currentAppVersion}
        dynamicSupported={dynamicSupported}
        themeState={themeState}
      />
      <ThemeIntroCard />
      <div className="md-dashboard-grid">
        <section className="md-section-card md-theme-section md-dashboard-primary-card">
          <div className="md-section-head">
            <h3>主题模式</h3>
            <span className="md-chip">立即切换</span>
          </div>
          <p className="md-section-hint">在支持的 Android 设备上默认跟随壁纸吸色，也可随时切换到预设或自定义调色板。</p>
          <ThemeModeButtons
            dynamicSupported={dynamicSupported}
            mode={themeState.preferences.mode}
            onThemeModeChange={onThemeModeChange}
          />
          <ThemePaletteSection
            customSeed={themeState.preferences.customSeed}
            presetId={themeState.preferences.presetId}
            onCustomSeedChange={onCustomSeedChange}
            onPresetChange={onPresetChange}
          />
        </section>
        <ThemePreviewPanel currentAppVersion={currentAppVersion} themeState={themeState} />
      </div>
    </div>
  )
}
