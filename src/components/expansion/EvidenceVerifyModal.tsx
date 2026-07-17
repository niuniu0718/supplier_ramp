import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { api } from '../../lib/api'
import type { EvidenceAttachment } from '../../types'

interface Props {
  evidence: EvidenceAttachment
  action: 'verify' | 'reject'
  onClose: () => void
  onVerified: () => void
}

export function EvidenceVerifyModal({ evidence, action, onClose, onVerified }: Props) {
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setError('')
    setSaving(true)
    try {
      await api.patch(`/api/evidence/${evidence.id}/verify`, { action, note })
      onVerified()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败。')
    } finally {
      setSaving(false)
    }
  }

  const isReject = action === 'reject'
  return (
    <Modal
      title={isReject ? '退回供应商佐证' : '通过佐证认证'}
      onClose={onClose}
      footer={
        <>
          <button className="button button-secondary" onClick={onClose} disabled={saving}>取消</button>
          <button
            className={isReject ? 'button button-danger' : 'button button-primary'}
            onClick={submit}
            disabled={saving}
          >
            {saving ? '提交中…' : (isReject ? '退回' : '通过')}
          </button>
        </>
      }
    >
      {error && <p className="form-error">{error}</p>}
      <div className="form-row">
        <label>佐证文件</label>
        <div style={{ fontSize: 13, color: 'var(--text)' }}>
          <strong>{evidence.name || evidence.fileName}</strong>
          <span className="muted" style={{ marginLeft: 8 }}>{evidence.fileName}</span>
        </div>
      </div>
      <div className="form-row">
        <label>上传人 / 角色</label>
        <div style={{ fontSize: 13 }}>
          {evidence.uploadedById}
          <span className="muted" style={{ marginLeft: 8 }}>
            {evidence.uploadedByRole === 'SUPPLIER' ? '· 供应商上传' : '· 内部上传'}
          </span>
        </div>
      </div>
      <div className="form-row">
        <label>
          {isReject ? '退回说明（必填）' : '认证备注（选填）'}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder={
            isReject
              ? '例：图片分辨率不够，无法辨识到货设备铭牌，请重新拍摄并保留原始时间戳。'
              : '例：已完成合规核对、字段完整，认证通过。'
          }
        />
        <small className="muted" style={{ display: 'block', marginTop: 4 }}>
          {isReject
            ? '退回后供应商可见原因，可重新上传。'
            : '通过后佐证进入正式证据档案，状态变为"已认证"。'}
        </small>
      </div>
    </Modal>
  )
}
