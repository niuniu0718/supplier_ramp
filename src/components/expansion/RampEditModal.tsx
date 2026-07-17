import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { DatePickerField } from '../ui/DatePickerField'
import { api } from '../../lib/api'
import { RAMP_STATUSES } from '../../lib/editOptions'
import type { RampRow } from '../../types'

interface Props {
  row: RampRow & { id?: number }
  rampId: number
  onClose: () => void
  onSaved: () => void
}

function serialize(v: string) {
  return v ? `${v}T00:00:00` : ''
}

export function RampEditModal({ row, rampId, onClose, onSaved }: Props) {
  const [actualCapacity, setActualCapacity] = useState(row.actualCapacity ?? '')
  const [confirmedAt, setConfirmedAt] = useState(row.confirmedAt?.slice(0, 10) ?? '')
  const [status, setStatus] = useState(row.status)
  const [note, setNote] = useState(row.note ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setError('')
    setSaving(true)
    try {
      const cap = actualCapacity === '' ? null : Number(actualCapacity)
      await api.patch(`/api/ramps/${rampId}`, {
        actual_capacity: cap,
        confirmed_at: serialize(confirmedAt),
        status,
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
      title={`编辑爬坡 · ${row.phase}（负荷 ${row.loadRate}%）`}
      onClose={onClose}
      width={540}
      footer={
        <>
          <button className="button button-secondary" onClick={onClose} disabled={saving}>取消</button>
          <button className="button button-primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
        </>
      }
    >
      {error && <p className="form-error">{error}</p>}
      <div className="form-row">
        <label>计划周期</label>
        <input value={row.plannedPeriod ?? ''} readOnly style={{ background: 'var(--surface-muted)' }} />
      </div>
      <div className="form-row-2col">
        <div className="form-row">
          <label>目标产能（吨/月）</label>
          <input value={row.targetCapacity.toLocaleString()} readOnly style={{ background: 'var(--surface-muted)' }} />
        </div>
        <div className="form-row">
          <label>实际达成产能</label>
          <input type="number" min={0} value={actualCapacity} onChange={(e) => setActualCapacity(e.target.value)} placeholder="例如 480" />
        </div>
      </div>
      <div className="form-row-2col">
        <div className="form-row">
          <label>达标状态</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as RampRow['status'])}>
            {RAMP_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <DatePickerField
          label="实际确认时间"
          value={confirmedAt}
          onChange={setConfirmedAt}
        />
      </div>
      <div className="form-row">
        <label>备注</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </div>
    </Modal>
  )
}