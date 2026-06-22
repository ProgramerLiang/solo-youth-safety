export function SummaryCard({ label, value, hint }) {
  return (
    <article className="md-summary-card">
      <span className="md-summary-label">{label}</span>
      <strong className="md-summary-value">{value}</strong>
      {hint ? <span className="md-summary-hint">{hint}</span> : null}
    </article>
  )
}
