export type RiskLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'

export type Role = 'PROCUREMENT_MANAGER' | 'PROCUREMENT_ENGINEER' | 'DEPARTMENT_LEADER' | 'SUPPLIER'

export interface UserSummary {
  id: string
  name: string
  role: Role
  title: string
  supplierId: string | null
  avatarColor: string
}

export interface Kpi {
  label: string
  value: number | string
  unit?: string
  hint?: string
  tone?: 'blue' | 'green' | 'yellow' | 'orange' | 'red' | 'purple'
}

export interface ExpansionPlanCard {
  id: string
  name: string
  supplierId: string
  supplierName: string
  supplierCategory: string
  materialName: string
  stage: string
  progress: number
  expectedProgress: number
  status: RiskLevel
  lag: number
  riskTypes: string[]
  updatedAt: string
}

export interface ExpansionOverviewPayload {
  board: string
  view: string
  generatedAt: string
  kpis: Kpi[]
  cards: ExpansionPlanCard[]
}

export interface ExpansionMilestoneItem {
  id: number
  name: string
  type: string
  vendor: string
  orderNo: string
  status: string
  expectedArrival: string
  actualArrival: string | null
  delayDays: number
  overdue: boolean
  supplierAction: string
  procurementAction: string
  note: string
  milestoneKey: string
  milestoneOrder: number
  milestoneName: string
}

export interface ExpansionTimelineRow {
  id: string
  name: string
  supplierName: string
  materialName: string
  startDate: string
  endDate: string
  stage: string
  progress: number
  expectedProgress: number
  status: RiskLevel
  lag: number
  itemCount: number
  overdueCount: number
  items: ExpansionMilestoneItem[]
}

export interface ExpansionTimelinePayload {
  board: string
  view: string
  generatedAt: string
  kpis: Kpi[]
  rows: ExpansionTimelineRow[]
}

export interface EvidenceItem {
  id: number
  category: string
  categoryLabel: string
  fileName: string
  url: string
  mimeType: string
  size: number
  note: string
  uploaderName: string
  uploadedAt: string
}

export interface EvidencePlanGroup {
  planId: string
  planName: string
  supplierName: string
  materialName: string
  progress: number
  status: string
  evidenceCount: number
  evidence: EvidenceItem[]
}

export interface ExpansionEvidencePayload {
  board: string
  view: string
  generatedAt: string
  kpis: Kpi[]
  planGroups: EvidencePlanGroup[]
  categoryCounts: Record<string, number>
}

export interface RiskRow {
  id: string
  type: string
  level: RiskLevel
  status: string
  description: string
  impactScope: string
  materialName: string
  supplierName: string
  actionCount: number
  openActionCount: number
  discoveredAt: string
}

export interface RisksOverviewPayload {
  board: string
  view: string
  generatedAt: string
  kpis: Kpi[]
  rows: RiskRow[]
}

export interface RisksByTypePayload {
  board: string
  view: string
  generatedAt: string
  kpis: Kpi[]
  rows: Array<{
    type: string
    label: string
    total: number
    red: number
    orange: number
    yellow: number
    green: number
    risks: Array<{
      id: string
      level: RiskLevel
      status: string
      materialName: string
      supplierName: string
      description: string
      openActions: number
    }>
  }>
}

export interface RisksEscalationPayload {
  board: string
  view: string
  generatedAt: string
  kpis: Kpi[]
  pending: Array<{
    id: string
    type: string
    level: RiskLevel
    status: string
    materialName: string
    supplierName: string
    description: string
    actions: Array<{
      id: string
      type: string
      status: string
      deadline: string
      taskId: string | null
      taskStatus: string | null
      taskProgress: number
    }>
  }>
  active: RisksEscalationPayload['pending']
  closed: RisksEscalationPayload['pending']
}

export interface RisksClosurePayload {
  board: string
  view: string
  generatedAt: string
  kpis: Kpi[]
  rows: Array<{
    id: string
    type: string
    materialName: string
    supplierName: string
    discoveredAt: string
    closedAt: string
    durationDays: number
  }>
  byType: Array<{ type: string; count: number }>
}

export interface TaskRow {
  id: string
  title: string
  ownerName: string
  ownerId?: string
  progress: number
  status: string
  deadline: string
  startDate?: string
  daysToDeadline?: number
  daysOverdue?: number
  riskId?: string
  riskLevel?: RiskLevel
  riskType?: string
  materialName?: string
  supplierName?: string
  actionType?: string
  priority?: string
  attachmentCount?: number
  progressDescription?: string
}

export interface TasksMyTodoPayload {
  board: string
  view: string
  generatedAt: string
  kpis: Kpi[]
  rows: TaskRow[]
}

export interface TasksOverduePayload {
  board: string
  view: string
  generatedAt: string
  kpis: Kpi[]
  rows: TaskRow[]
}

export interface TasksEscalationPayload {
  board: string
  view: string
  generatedAt: string
  kpis: Kpi[]
  remind: TaskRow[]
  overdue: TaskRow[]
  escalated: TaskRow[]
}

export interface TasksClosurePayload {
  board: string
  view: string
  generatedAt: string
  kpis: Kpi[]
  rows: Array<{
    id: string
    title: string
    ownerName: string
    priority: string
    riskType: string
    closedAt: string
    durationDays: number
  }>
  byPriority: Array<{ priority: string; count: number }>
}

export interface NotificationItem {
  id: number
  type: string
  level: string
  title: string
  message: string
  link: string
  isRead: boolean
  createdAt: string
}

export interface BoardPayloadMap {
  expansion: {
    overview: ExpansionOverviewPayload
    timeline: ExpansionTimelinePayload
    evidence: ExpansionEvidencePayload
  }
  risks: {
    overview: RisksOverviewPayload
    'by-type': RisksByTypePayload
    escalation: RisksEscalationPayload
    closure: RisksClosurePayload
  }
  tasks: {
    'my-todo': TasksMyTodoPayload
    overdue: TasksOverduePayload
    escalation: TasksEscalationPayload
    closure: TasksClosurePayload
  }
}

export type BoardId = keyof BoardPayloadMap
export type ViewId<B extends BoardId> = keyof BoardPayloadMap[B]