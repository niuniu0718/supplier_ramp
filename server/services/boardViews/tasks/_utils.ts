export function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000)
}

export type EscalationLevel = 'NORMAL' | 'REMIND' | 'OVERDUE' | 'ESCALATED'

export function escalationLevel(deadline: Date, now = new Date()): {
  level: EscalationLevel
  daysToDeadline: number
} {
  const days = daysBetween(deadline, now)
  if (days < -7) return { level: 'ESCALATED', daysToDeadline: days }
  if (days < 0) return { level: 'OVERDUE', daysToDeadline: days }
  if (days <= 3) return { level: 'REMIND', daysToDeadline: days }
  return { level: 'NORMAL', daysToDeadline: days }
}