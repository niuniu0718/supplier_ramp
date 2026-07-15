import type { ReactNode } from 'react'

interface LoadingStateProps { label?: string }
export function LoadingState({ label = '加载中…' }: LoadingStateProps) {
  return <div className="state-box loading"><span className="spinner" />{label}</div>
}

interface ErrorStateProps { message: string; onRetry?: () => void }
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="state-box error">
      <strong>出现错误</strong>
      <p>{message}</p>
      {onRetry && <button onClick={onRetry} className="button button-secondary">重试</button>}
    </div>
  )
}

interface EmptyStateProps { title: string; description?: string; action?: ReactNode }
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="state-box empty">
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}