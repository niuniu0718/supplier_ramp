import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { DatePickerField } from '../ui/DatePickerField'
import { api } from '../../lib/api'
import { PASS_STATUSES } from '../../lib/editOptions'
import type { CommissioningRow } from '../../types'

interface Props {
  row: CommissioningRow & { id?: number }
  commissioningId: number
  onClose: () => void
  onSaved: () => void
}

function serialize(v: string) {
  return v ? `${v}T00:00:00` : ''
}

export function CommissioningEditModal({ row, commissioningId, onClose, onSaved }: Props) {
  const [targetValue, setTargetValue] = useState(row.targetValue ?? '')
  const [actualValue, setActualValue] = useState(row.actualValue ?? '')
  const [passStatus, setPassStatus] = useState(row.passStatus)
  const [verifiedAt, setVerifiedAt] = useState(row.verifiedAt?.slice(0, 10) ?? '')
  const [note, setNote] = useState(row.note ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setError('')
    setSaving(true)
    try {
      await api.patch(`/api/commissionings/${commissioningId}`, {
        target_value: targetValue,
        actual_value: actualValue,
        pass_status: passStatus,
        verified_at: serialize(verifiedAt),
        note,
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`编辑试车验证 · ${row.order}. ${row.name}`}
      onClose={onClose}
      width={580}
      footer={
        <>
          <button className="button button-secondary" onClick={onClose} disabled={saving}>取消</button>
          <button className="button button-primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
        </>
      }
    >
      {error && <p className="form-error">{error}</p>}
      <div className="form-row">
        <label>验证标准</label>
        <input value={row.standard ?? ''} readOnly style={{ background: 'var(--surface-muted)' }} />
      </div>
      <div className="form-row-2col">
        <div className="form-row">
          <label>目标值</label>
          <input value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="例如：72h 满负荷 ≥90%" />
        </div>
        <div className="form-row">
          <label>实测值</label>
          <input value={actualValue} onChange={(e) => setActualValue(e.target.value)} placeholder="例如：71.5h 满负荷 92%" />
        </div>
      </div>
      <div className="form-row-2col">
        <div className="form-row">
          <label>合格判定</label>
          <select value={passStatus} onChange={(e) => setPassStatus(e.target.value as CommissioningRow['passStatus'])}>
            {PASS_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <DatePickerField label="验证日期" value={verifiedAt} onChange={setVerifiedAt} />
      </div>
      <div className="form-row">
        <label>备注</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </div>
    </Modal>
  )
}