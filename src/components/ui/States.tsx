import { AlertCircle, LoaderCircle } from 'lucide-react'

export function LoadingState({ label = '正在加载数据' }: { label?: string }) {
  return <div className="state-panel"><LoaderCircle className="spin" size={24} /><span>{label}</span></div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-panel state-error">
      <AlertCircle size={24} />
      <span>{message}</span>
      {onRetry && <button className="button button-secondary button-small" onClick={onRetry}>重新加载</button>}
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><strong>{title}</strong><span>{description}</span></div>
}
