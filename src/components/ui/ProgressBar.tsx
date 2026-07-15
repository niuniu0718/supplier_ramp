interface ProgressBarProps {
  progress: number
  expected?: number
  height?: number
}

export function ProgressBar({ progress, expected, height = 10 }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, progress))
  const exp = expected !== undefined ? Math.max(0, Math.min(100, expected)) : null
  return (
    <div className="progress-bar" style={{ height }}>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${clamped}%` }} />
        {exp !== null && (
          <>
            <div className="progress-expected-marker" style={{ left: `${exp}%` }} />
            <div className="progress-expected-label" style={{ left: `${exp}%` }}>预期 {exp}%</div>
          </>
        )}
      </div>
      <strong>{clamped}%</strong>
    </div>
  )
}