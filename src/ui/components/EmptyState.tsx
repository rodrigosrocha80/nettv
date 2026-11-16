export interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="ntv-state-box">
      <h3 className="ntv-state-title">{title}</h3>
      {description && <p className="ntv-state-desc">{description}</p>}
    </div>
  );
}
