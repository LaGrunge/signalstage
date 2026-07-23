export function CardGrid({ children }) {
  return <div className="card-grid">{children}</div>;
}

export function PreviewCard({ title, subtitle, preview, footer, onClick, actions }) {
  return (
    <div className="card" onClick={onClick}>
      <div className="card-head">
        <strong>{title}</strong>
        {subtitle && <span className="muted">{subtitle}</span>}
      </div>
      <pre className="card-preview">{preview || " "}</pre>
      <div className="card-footer">
        <span className="muted">{footer}</span>
        {actions && (
          <div className="card-actions" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
