import { applyDeadlineEscalations } from '../services/workflow.js'

const HOUR_MS = 60 * 60 * 1000

export function startEscalationJob() {
  const tick = async () => {
    try {
      const result = await applyDeadlineEscalations()
      if (result.yellowed || result.oranged || result.reddened) {
        console.log(
          `[escalation] 扫描 ${result.scanned} | 黄 ${result.yellowed} 橙 ${result.oranged} 红 ${result.reddened}`,
        )
      }
    } catch (error) {
      console.error('[escalation] 失败', error)
    }
  }
  tick()
  setInterval(tick, HOUR_MS)
  console.log('[escalation] 每小时扫描任务截止状态')
}