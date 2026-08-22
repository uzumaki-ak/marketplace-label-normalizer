export interface ProgressBarProps {
  readonly value: number;
  readonly label: string;
  readonly className?: string;
}

export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const boundedValue = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div className={className}>
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={boundedValue}
        className="progress-track"
        role="progressbar"
      >
        <span className="progress-fill" style={{ width: `${boundedValue}%` }} />
      </div>
    </div>
  );
}
