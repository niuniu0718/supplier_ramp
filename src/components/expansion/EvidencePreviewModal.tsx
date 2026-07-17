import { useState } from 'react'
import { FileText, Image as ImageIcon, Paperclip, X, ExternalLink } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { verificationMeta } from '../../lib/evidenceMeta'
import type { EvidenceAttachment } from '../../types'

interface Props {
  evidence: EvidenceAttachment
  onClose: () => void
}

function evidenceIcon(mime: string) {
  if (mime.startsWith('image/')) return <ImageIcon size={16} />
  if (mime === 'application/pdf') return <FileText size={16} />
  return <Paperclip size={16} />
}

export function EvidencePreviewModal({ evidence, onClose }: Props) {
  const [loadFailed, setLoadFailed] = useState(false)
  const meta = verificationMeta(evidence.verificationStatus)

  const isImage = evidence.mimeType?.startsWith('image/')
  const isPdf = evidence.mimeType === 'application/pdf'
  const baseUrl = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000').replace(/\/$/, '')
  const fullUrl = evidence.url.startsWith('http') ? evidence.url : `${baseUrl}${evidence.url}`

  return (
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
          <button className="button button-primary" onClick={onClose}>关闭</button>
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
  )
}