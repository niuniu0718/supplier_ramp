import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { DatePickerField } from '../ui/DatePickerField'
import { api } from '../../lib/api'
import { ITEM_STATUSES } from '../../lib/editOptions'
import type { ExpansionMilestoneItem } from '../../types'

interface Props {
  item: ExpansionMilestoneItem
  planId: string
  onClose: () => void
  onSaved: (updatedItem?: ExpansionMilestoneItem) => void
}

export function MilestoneEditModal({ item, onClose, onSaved }: Props) {
  const [status, setStatus] = useState(item.status)
  const [expected, setExpected] = useState(item.expectedArrival?.slice(0, 10) ?? '')
  const [actual, setActual] = useState(item.actualArrival?.slice(0, 10) ?? '')
  const [supplierAction, setSupplierAction] = useState(item.supplierAction ?? '')
  const [procurementAction, setProcurementAction] = useState(item.procurementAction ?? '')
  const [note, setNote] = useState(item.note ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function serialize(v: string) {
    return v ? `${v}T00:00:00` : ''
  }

  async function save() {
    setError('')
    if (!expected) {
      setError('请填写计划完成日期。')
      return
    }
    setSaving(true)
    try {
      const resp = await api.patch<{ item: ExpansionMilestoneItem }>(`/api/expansion-items/${item.id}`, {
        status,
        expected_arrival: serialize(expected),
        actual_arrival: serialize(actual),
        supplier_action: supplierAction,
        procurement_action: procurementAction,
        note,
      })
      onSaved(resp.item)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`编辑阀点 · 阀点 ${item.milestoneOrder} ${item.milestoneName ?? item.name}`}
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
        <label>状态</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {ITEM_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
      <div className="form-row-2col">
        <DatePickerField label="计划完成日期" value={expected} onChange={setExpected} />
        <DatePickerField label="实际完成日期" value={actual} onChange={setActual} />
      </div>
      <div className="form-row">
        <label>供应商侧行动</label>
        <textarea value={supplierAction} onChange={(e) => setSupplierAction(e.target.value)} rows={2} />
      </div>
      <div className="form-row">
        <label>采购侧行动</label>
        <textarea value={procurementAction} onChange={(e) => setProcurementAction(e.target.value)} rows={2} />
      </div>
      <div className="form-row">
        <label>备注</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </div>
    </Modal>
  )
}