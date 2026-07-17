import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'

interface Props {
  label?: string
  value: string                  // 当前的 YYYY-MM-DD 或 ''
  onChange: (value: string) => void
  placeholder?: string
}

/**
 * 极简版日期输入：原生 date picker + 可选的清除按钮（小×，值非空时显示）。
 * 不再加「今天/本月/按月/按日」等额外按钮，保持原生的简洁外观。
 * 点击清除后会出现 1.2s 的「✓ 已清除」确认反馈，避免与未填状态混淆。
 */
export function DatePickerField({ label, value, onChange, placeholder = 'YYYY-MM-DD' }: Props) {
  const [hovered, setHovered] = useState(false)
  const [justCleared, setJustCleared] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  function handleClear() {
    onChange('')
    setJustCleared(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setJustCleared(false), 1200)
  }

  return (
    <div className="date-picker-field-simple">
      {label && <label>{label}</label>}
      <div
        className={`date-picker-input-simple ${hovered ? 'is-hovered' : ''} ${justCleared ? 'is-just-cleared' : ''} ${!value ? 'is-empty' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <input
          type="date"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {justCleared ? (
          <span className="date-picker-cleared-hint" role="status" aria-live="polite">
            <Check size={12} /> 已清除
          </span>
        ) : value ? (
          <button
            type="button"
            className="date-picker-clear-simple"
            onClick={handleClear}
            title="清除选择"
          >
            <X size={12} />
          </button>
        ) : null}
      </div>
    </div>
  )
}