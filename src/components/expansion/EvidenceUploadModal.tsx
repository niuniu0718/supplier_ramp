import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { api } from '../../lib/api'

interface Props {
  planId: string
  planName: string
  targetKind: 'plan' | 'item' | 'approval' | 'commissioning' | 'ramp'
  targetId: number | null
  targetLabel?: string
  onClose: () => void
  onUploaded: () => void
}

export function EvidenceUploadModal({
  planId, planName, targetKind, targetId, targetLabel, onClose, onUploaded,
}: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  async function upload() {
    setError('')
    if (!file) {
      setError('请选择文件。')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('target_kind', targetKind)
      fd.append('target_id', targetKind === 'plan' ? planId : String(targetId ?? ''))
      fd.append('name', name)
      fd.append('note', note)
      await api.upload(`/api/evidence`, fd)
      onUploaded()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败。')
    } finally {
      setUploading(false)
    }
  }

  const titleSuffix = targetLabel ? ` · ${targetLabel}` : ''
  return (
    <Modal
      title={`上传佐证 · ${planName}${titleSuffix}`}
      onClose={onClose}
      footer={
        <>
          <button className="button button-secondary" onClick={onClose} disabled={uploading}>取消</button>
          <button className="button button-primary" onClick={upload} disabled={uploading || !file}>
            {uploading ? '上传中…' : '上传'}
          </button>
        </>
      }
    >
      {error && <p className="form-error">{error}</p>}
      <div className="form-row">
        <label>选择文件</label>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file && <small className="muted" style={{ display: 'block', marginTop: 4 }}>
          {file.name} · {(file.size / 1024).toFixed(0)} KB
        </small>}
      </div>
      <div className="form-row">
        <label>佐证名称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例：回转窑 1# 到货验收现场"
        />
        <small className="muted" style={{ display: 'block', marginTop: 4 }}>
          自定义显示名称，便于在时间轴/证据档案中快速定位；留空则用文件名。
        </small>
      </div>
      <div className="form-row">
        <label>备注</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="例：采购现场取景，已签收" />
      </div>
    </Modal>
  )
}
