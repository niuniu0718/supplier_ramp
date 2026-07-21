import { useEffect, useState } from 'react'
import { Check, FileText, Image as ImageIcon, Paperclip, Upload, X } from 'lucide-react'
import { BoardShell } from '../../components/layout/BoardShell'
import { KpiCard } from '../../components/ui/KpiCard'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { EvidenceUploadModal } from '../../components/expansion/EvidenceUploadModal'
import { EvidenceVerifyModal } from '../../components/expansion/EvidenceVerifyModal'
import { api } from '../../lib/api'
import { verificationMeta } from '../../lib/evidenceMeta'
import type { EvidenceAttachment, EvidenceTarget, ExpansionEvidencePayload } from '../../types'

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

const KIND_LABELS: Record<EvidenceTarget['kind'], string> = {
  plan: '整计划',
  item: '阀点',
  approval: '审批',
  commissioning: '试产',
  ramp: '爬坡',
}

export function ExpansionEvidence() {
  const [data, setData] = useState<ExpansionEvidencePayload | null>(null)
  const [error, setError] = useState('')
  const [uploadingAt, setUploadingAt] = useState<EvidenceTarget | null>(null)
  const [verifying, setVerifying] = useState<{ evidence: EvidenceAttachment; action: 'verify' | 'reject' } | null>(null)

  function reload() {
    return api.get<ExpansionEvidencePayload>('/api/boards/expansion/views/evidence').then(setData)
  }

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
      description="按目标节点归档：整计划 / 8 个阀点 / 6 项审批 / 6 项试产 / 4 个爬坡阶段"
      views={VIEWS}
      kpis={data.kpis.map((k, i) => <KpiCard key={i} kpi={k} />)}
    >
      {data.planGroups.length === 0 ? (
        <p className="muted">暂无证据。在里程碑时间轴页面选定任意阀点/审批/试产/爬坡或计划，点击 [+佐证] 即可添加。</p>
      ) : data.planGroups.map((g) => (
        <article key={g.planId} className="panel evidence-panel">
          <div className="panel-title">
            <div>
              <strong>{g.planName}</strong>
              <small style={{ marginLeft: 10, color: 'var(--text-muted)' }}>
                {g.supplierName} · 共 {g.evidenceCount} 份证据
              </small>
            </div>
            <button
              type="button"
              className="text-button text-button-primary"
              onClick={() => setUploadingAt({ kind: 'plan', planId: g.planId, planName: g.planName })}
            >
              <Upload size={12} /> 上传整计划
            </button>
          </div>
          <div className="evidence-tree">
            {g.nodes.map((n) => (
              <section key={`${n.kind}:${n.targetId ?? 'p'}`} className="evidence-node">
                <header className="evidence-node-head">
                  <span className="evidence-node-kind">{KIND_LABELS[n.kind]}</span>
                  <strong>{n.label}</strong>
                  <button
                    type="button"
                    className="row-edit-btn"
                    onClick={() => setUploadingAt({
                      kind: n.kind,
                      planId: g.planId,
                      planName: g.planName,
                      targetId: n.targetId ?? 0,
                      targetLabel: n.label,
                    })}
                  >
                    <Upload size={11} /> +佐证
                  </button>
                </header>
                <div className="evidence-timeline">
                  {n.evidence.map((e) => {
                    const meta = verificationMeta(e.verificationStatus)
                    return (
                      <div
                        key={e.id}
                        className={`evidence-item verification-${meta.tone}`}
                      >
                        <h4>
                          {categoryIcon(e.mimeType)}
                          <a href={e.url} target="_blank" rel="noreferrer">
                            {e.name || e.fileName}
                          </a>
                          <span
                            className="evidence-verification-tag"
                            style={{ color: meta.color, background: meta.bg }}
                            title={
                              e.verifiedAt
                                ? `${e.verifiedById || '已认证人'} · ${new Date(e.verifiedAt).toLocaleString('zh-CN')}`
                                : undefined
                            }
                          >
                            {meta.label}
                          </span>
                          {e.uploadedByRole === 'SUPPLIER' && (
                            <span className="evidence-uploader-tag">供应商上传</span>
                          )}
                        </h4>
                        <small>{e.note || '—'}</small>
                        {e.verificationStatus === 'REJECTED' && e.verifiedNote && (
                          <div className="evidence-reject-note">
                            <strong>退回原因：</strong>{e.verifiedNote}
                            <span className="muted" style={{ marginLeft: 6 }}>
                              {e.verifiedById} · {e.verifiedAt ? new Date(e.verifiedAt).toLocaleString('zh-CN') : ''}
                            </span>
                          </div>
                        )}
                        <div className="evidence-meta">
                          <span className="muted">{(e.size / 1024).toFixed(0)} KB</span>
                          <small>上传人 {e.uploadedById}</small>
                          <small>{new Date(e.uploadedAt).toLocaleString('zh-CN')}</small>
                        </div>
                        {e.requiresVerification && e.verificationStatus === 'PENDING' && (
                          <div className="evidence-verify-actions">
                            <button
                              type="button"
                              className="button button-primary button-small"
                              onClick={() => setVerifying({ evidence: e, action: 'verify' })}
                            >
                              <Check size={12} /> 通过
                            </button>
                            <button
                              type="button"
                              className="button button-danger button-small"
                              onClick={() => setVerifying({ evidence: e, action: 'reject' })}
                            >
                              <X size={12} /> 退回
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </article>
      ))}
      {uploadingAt && (
        <EvidenceUploadModal
          planId={uploadingAt.planId}
          planName={uploadingAt.planName}
          targetKind={uploadingAt.kind}
          targetId={uploadingAt.kind === 'plan' ? null : uploadingAt.targetId}
          targetLabel={uploadingAt.kind === 'plan' ? undefined : uploadingAt.targetLabel}
          onClose={() => setUploadingAt(null)}
          onUploaded={async () => { await reload() }}
        />
      )}
      {verifying && (
        <EvidenceVerifyModal
          evidence={verifying.evidence}
          action={verifying.action}
          onClose={() => setVerifying(null)}
          onVerified={async () => { await reload() }}
        />
      )}
    </BoardShell>
  )
}
