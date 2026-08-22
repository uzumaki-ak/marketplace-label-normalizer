export interface StatusBadgeProps {
  readonly status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className="status-badge" data-status={status}>
      <span aria-hidden="true" className="status-marker" />
      {status.replaceAll("_", " ")}
    </span>
  );
}
