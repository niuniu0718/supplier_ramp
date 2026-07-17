import { Paperclip } from 'lucide-react'
import type { EvidenceAttachment } from '../../types'

interface Props {
  evidence: EvidenceAttachment[]
  onPreview: (evidence: EvidenceAttachment) => void
  emptyText?: string
  maxInline?: number
}

export function EvidenceChipList({ evidence, onPreview, emptyText = '—', maxInline = 3 }: Props) {
  if (!evidence.length) {
    return <span className="muted">{emptyText}</span>
  }
  const visible = evidence.slice(0, maxInline)
  const overflow = evidence.length - visible.length
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      <Paperclip size={11} className="muted" />
      {visible.map((e) => (
        <button
          key={e.id}
          type="button"
          className={`evidence-chip clickable verification-${e.verificationStatus === 'VERIFIED' ? 'verified' : e.verificationStatus === 'REJECTED' ? 'rejected' : e.requiresVerification ? 'pending' : 'neutral'}`}
          onClick={() => onPreview(e)}
          title={`${e.name}${e.requiresVerification ? ` · ${e.verificationStatus === 'VERIFIED' ? '已认证' : e.verificationStatus === 'REJECTED' ? '已退回' : '待认证'}` : ''}（点击预览）`}
        >
          {e.name}
        </button>
      ))}
      {overflow > 0 && <span className="muted" style={{ fontSize: 11 }}>+{overflow}</span>}
    </span>
  )
}