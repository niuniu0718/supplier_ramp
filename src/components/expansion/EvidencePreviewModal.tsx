import { useState } from 'react'
import { Check, ExternalLink, FileText, Image as ImageIcon, Paperclip, X, XCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { verificationMeta } from '../../lib/evidenceMeta'
import { EvidenceVerifyModal } from './EvidenceVerifyModal'
import type { EvidenceAttachment } from '../../types'

interface Props {
  evidence: EvidenceAttachment
  onClose: () => void
  // 再认证后由父组件回调（用于刷新列表/时间轴）
  onVerified?: () => void
}

function evidenceIcon(mime: string) {
  if (mime.startsWith('image/')) return <ImageIcon size={16} />
  if (mime === 'application/pdf') return <FileText size={16} />
  return <Paperclip size={16} />
}

export function EvidencePreviewModal({ evidence, onClose, onVerified }: Props) {
  const [loadFailed, setLoadFailed] = useState(false)
  const [verifying, setVerifying] = useState<'verify' | 'reject' | null>(null)
  const meta = verificationMeta(evidence.verificationStatus)

  const isImage = evidence.mimeType?.startsWith('image/')
  const isPdf = evidence.mimeType === 'application/pdf'
  const baseUrl = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000').replace(/\/$/, '')
  const fullUrl = evidence.url.startsWith('http') ? evidence.url : `${baseUrl}${evidence.url}`

  // 仅供应商上传 + 待再认证的佐证，在预览时直接提供通过 / 退回入口
  const canReview = evidence.requiresVerification && evidence.verificationStatus === 'PENDING'

  return (
    <>
      <Modal
        title={`佐证预览 · ${evidence.name || evidence.fileName}`}
        onClose={onClose}
        width={760}
        footer={
          <>
            <a
              className="button button-secondary"
              href={fullUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={12} /> 在新标签页打开
            </a>
            {canReview ? (
              <>
                <button
                  type="button"
                  className="button button-danger"
                  onClick={() => setVerifying('reject')}
                  title="退回供应商，并附上原因"
                >
                  <XCircle size={12} /> 退回供应商
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setVerifying('verify')}
                  title="通过认证，进入正式证据档案"
                >
                  <Check size={12} /> 通过认证
                </button>
              </>
            ) : (
              <button className="button button-primary" onClick={onClose}>关闭</button>
            )}
          </>
        }
      >
        <div className="evidence-preview-meta">
          <div className="evidence-preview-meta-row">
            {evidenceIcon(evidence.mimeType)}
            <strong>{evidence.fileName}</strong>
            <span
              className="evidence-verification-tag"
              style={{ color: meta.color, background: meta.bg }}
            >
              {meta.label}
            </span>
            {evidence.uploadedByRole === 'SUPPLIER' && (
              <span className="evidence-uploader-tag">供应商上传</span>
            )}
          </div>
          <div className="evidence-preview-meta-grid">
            <div><small>大小</small><span>{(evidence.size / 1024).toFixed(0)} KB</span></div>
            <div><small>上传人</small><span>{evidence.uploadedById}</span></div>
            <div><small>上传时间</small><span>{new Date(evidence.uploadedAt).toLocaleString('zh-CN')}</span></div>
            {evidence.verifiedAt && (
              <div><small>认证时间</small><span>{new Date(evidence.verifiedAt).toLocaleString('zh-CN')} · {evidence.verifiedById}</span></div>
            )}
          </div>
          {evidence.note && (
            <div className="evidence-preview-note">
              <small>备注</small>
              <p>{evidence.note}</p>
            </div>
          )}
          {evidence.verificationStatus === 'REJECTED' && evidence.verifiedNote && (
            <div className="evidence-reject-note">
              <strong>退回原因：</strong>{evidence.verifiedNote}
            </div>
          )}
          {canReview && (
            <div className="evidence-preview-hint muted">
              <Paperclip size={12} /> 该佐证由供应商上传、需责任采购再认证。
              可直接在下方预览后选择「通过认证」或「退回供应商」并附说明，无需跳转其他页面。
            </div>
          )}
        </div>
        <div className="evidence-preview-body">
          {loadFailed ? (
            <div className="evidence-preview-fallback">
              <Paperclip size={32} />
              <p>无法加载预览（演示数据 / 文件已删除）</p>
              <a className="button button-secondary" href={fullUrl} target="_blank" rel="noreferrer">
                尝试在新标签页打开
              </a>
            </div>
          ) : isImage ? (
            <img
              src={fullUrl}
              alt={evidence.name}
              className="evidence-preview-image"
              onError={() => setLoadFailed(true)}
            />
          ) : isPdf ? (
            <iframe
              src={fullUrl}
              title={evidence.name}
              className="evidence-preview-iframe"
              onError={() => setLoadFailed(true)}
            />
          ) : (
            <div className="evidence-preview-fallback">
              <Paperclip size={32} />
              <p>该类型文件暂不支持内嵌预览</p>
              <a className="button button-secondary" href={fullUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={12} /> 在新标签页打开
              </a>
            </div>
          )}
        </div>
      </Modal>

      {verifying && (
        <EvidenceVerifyModal
          evidence={evidence}
          action={verifying}
          onClose={() => setVerifying(null)}
          onVerified={() => {
            setVerifying(null)
            // 触发父组件重新拉数据，让 chip 状态立刻更新
            onVerified?.()
            onClose()
          }}
        />
      )}
    </>
  )
}