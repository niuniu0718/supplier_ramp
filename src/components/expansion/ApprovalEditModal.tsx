import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { DatePickerField } from '../ui/DatePickerField'
import { api } from '../../lib/api'
import type { ApprovalRow } from '../../types'

interface Props {
  row: ApprovalRow & { id?: number }
  approvalId: number
  onClose: () => void
  onSaved: () => void
}

function serialize(v: string) {
  return v ? `${v}T00:00:00` : ''
}

export function ApprovalEditModal({ row, approvalId, onClose, onSaved }: Props) {
  const [submitted, setSubmitted] = useState(row.submittedAt?.slice(0, 10) ?? '')
  const [expected, setExpected] = useState(row.expectedAt?.slice(0, 10) ?? '')
  const [actual, setActual] = useState(row.actualAt?.slice(0, 10) ?? '')
  const [note, setNote] = useState(row.note ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setError('')
    setSaving(true)
    try {
      await api.patch(`/api/approvals/${approvalId}`, {
        submitted_at: serialize(submitted),
        expected_at: serialize(expected),
        actual_at: serialize(actual),
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
      title={`编辑审批 · ${row.order}. ${row.name}`}
      onClose={onClose}
      width={520}
      footer={
        <>
          <button className="button button-secondary" onClick={onClose} disabled={saving}>取消</button>
          <button className="button button-primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
        </>
      }
    >
      {error && <p className="form-error">{error}</p>}
      <div className="form-row">
        <label>审批机构</label>
        <input value={row.agency} readOnly style={{ background: 'var(--surface-muted)' }} />
      </div>
      <div className="form-row-2col">
        <DatePickerField label="提交日期" value={submitted} onChange={setSubmitted} />
        <DatePickerField label="预计批复" value={expected} onChange={setExpected} />
      </div>
      <div className="form-row">
        <DatePickerField label="实际批复" value={actual} onChange={setActual} />
      </div>
      <div className="form-row">
        <label>备注</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </div>
    </Modal>
  )
}