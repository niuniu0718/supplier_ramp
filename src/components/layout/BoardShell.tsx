import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ViewTabs, type ViewTabItem } from './ViewTabs'

interface BoardShellProps {
  title: string
  description?: string
  boardId: string
  boardLabel: string
  views: ViewTabItem[]
  kpis?: ReactNode
  rightSlot?: ReactNode
  children: ReactNode
}

export function BoardShell({ title, description, boardId, boardLabel, views, kpis, rightSlot, children }: BoardShellProps) {
  const [searchParams] = useSearchParams()
  const deepLink = Object.fromEntries(searchParams.entries())
  return (
    <section className="board-shell">
      <header className="board-header">
        <div>
          <span className="board-eyebrow">{boardLabel}</span>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
      </header>
      <div className="board-tabs-row">
        <ViewTabs boardId={boardId} views={views} />
        {rightSlot && <div className="board-tabs-actions">{rightSlot}</div>}
      </div>
      {kpis && <div className="board-kpis">{kpis}</div>}
      <div className="board-body" data-deeplink={JSON.stringify(deepLink)}>
        {children}
      </div>
    </section>
  )
}