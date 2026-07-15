import { useEffect, useState } from 'react'
import { FileText, Image as ImageIcon, Paperclip } from 'lucide-react'
import { BoardShell } from '../../components/layout/BoardShell'
import { KpiCard } from '../../components/ui/KpiCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { api } from '../../lib/api'
import type { ExpansionEvidencePayload } from '../../types'

const VIEWS = [
  { to: '/board/expansion/view/overview', label: '进度总览' },
  { to: '/board/expansion/view/timeline', label: '里程碑时间轴' },
  { to: '/board/expansion/view/evidence', label: '证据档案' },
]

function categoryIcon(mime: string) {
  if (mime.startsWith('image/')) return <ImageIcon size={14} />
  if (mime === 'application/pdf') return <FileText size={14} />
  return <Paperclip size={14} />
}

export function ExpansionEvidence() {
  const [data, setData] = useState<ExpansionEvidencePayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<ExpansionEvidencePayload>('/api/boards/expansion/views/evidence')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败。'))
  }, [])

  if (error) return <ErrorState message={error} />
  if (!data) return <LoadingState label="加载证据档案…" />

  return (
    <BoardShell
      boardId="expansion"
      boardLabel="扩产跟踪"
      title="证据档案"
      description="所有扩产计划上传的设备到货、合同、付款、检测报告"
      views={VIEWS}
      kpis={data.kpis.map((k, i) => <KpiCard key={i} kpi={k} />)}
    >
      {data.planGroups.map((g) => (
        <article key={g.planId} className="panel">
          <div className="panel-title">
            <div>
              <strong>{g.planName}</strong>
              <small style={{ marginLeft: 10, color: 'var(--text-muted)' }}>
                {g.supplierName} · {g.materialName} · 进度 {g.progress}%
              </small>
            </div>
            <div>
              <StatusBadge status={g.status} short />
              <small style={{ marginLeft: 10 }}>{g.evidenceCount} 份证据</small>
            </div>
          </div>
          {g.evidence.length === 0 ? (
            <p className="muted">暂无证据。供应商可在门户上传设备到货、合同、付款凭证等。</p>
          ) : (
            <div className="evidence-timeline">
              {g.evidence.map((e) => (
                <div key={e.id} className="evidence-item">
                  <h4>{e.fileName}</h4>
                  <small>{e.note || '—'}</small>
                  <div className="evidence-meta">
                    <span className="evidence-tag">{e.categoryLabel}</span>
                    <span className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {categoryIcon(e.mimeType)} {(e.size / 1024).toFixed(0)} KB
                    </span>
                    <small>上传人 {e.uploaderName}</small>
                    <small>{new Date(e.uploadedAt).toLocaleString('zh-CN')}</small>
                    <a href={e.url} target="_blank" rel="noreferrer" className="text-button">查看</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      ))}
    </BoardShell>
  )
}