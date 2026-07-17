export type RiskLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'

// === 9 类风险类型（与后端 backend/app/api/risks.py TYPE_LABELS 一致）===
export type RiskTypeKey =
  // 物料级 5 类
  | 'SINGLE_SOURCE'
  | 'LOW_INVENTORY'
  | 'PRICE'
  | 'POLICY'
  | 'QUALITY'
  // L2 节点级 4 类
  | 'APPROVAL_OVERDUE'
  | 'COMMISSIONING_FAIL'
  | 'RAMP_BELOW_TARGET'
  | 'MILESTONE_DELAYED'

export type RiskSourceKind = 'item' | 'approval' | 'commissioning' | 'ramp'

export interface RiskSource {
  kind: RiskSourceKind | null
  id: number | null
  planId: string
  planName: string
  label: string
  status?: string
  expectedArrival?: string | null
  actualArrival?: string | null
  submittedAt?: string | null
  expectedAt?: string | null
  actualAt?: string | null
  verifiedAt?: string | null
  confirmedAt?: string | null
}

export interface PendingRiskSignal {
  type: RiskTypeKey
  level: RiskLevel
  delayDays: number
  reason: string
}

export interface UpgradedRiskRef {
  id: string
  type: RiskTypeKey | string
  level: RiskLevel
  status: string
  closedAt: string | null
  discoveredAt: string | null
  updatedAt: string | null
}

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

export type EvidenceVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'

export interface EvidenceAttachment {
  id: number
  planId: string
  targetKind: 'plan' | 'item' | 'approval' | 'commissioning' | 'ramp'
  targetId: number | null
  name: string
  fileName: string
  url: string
  note: string
  size: number
  mimeType: string
  uploadedAt: string
  uploadedById: string
  uploadedByRole: string
  requiresVerification: boolean
  verificationStatus: EvidenceVerificationStatus
  verifiedById: string | null
  verifiedAt: string | null
  verifiedNote: string
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
  evidence: EvidenceAttachment[]
  pendingRiskSignal: PendingRiskSignal | null
  upgradedRisk: UpgradedRiskRef | null
}

export interface ExpansionTimelineRow {
  id: string
  name: string
  supplierName: string
  materialName: string
  materialId?: string
  startDate: string
  endDate: string
  stage: string
  progress: number
  expectedProgress: number
  status: RiskLevel
  autoStatus?: RiskLevel
  lag: number
  riskDescription?: string
  itemCount: number
  overdueCount: number
  completedItemCount?: number
  totalItemCount?: number
  approvals: ApprovalRow[]
  commissionings: CommissioningRow[]
  ramps: RampRow[]
  items: ExpansionMilestoneItem[]
  evidence: EvidenceAttachment[]
}

export interface ApprovalRow {
  id: number
  order: number
  type: string
  name: string
  agency: string
  submittedAt: string | null
  expectedAt: string | null
  actualAt: string | null
  status: '未开始' | '进行中' | '已完成' | '已逾期'
  overdue: boolean
  note: string
  evidence: EvidenceAttachment[]
  pendingRiskSignal: PendingRiskSignal | null
  upgradedRisk: UpgradedRiskRef | null
}

export interface CommissioningRow {
  id: number
  order: number
  type: string
  name: string
  standard: string
  targetValue: string
  actualValue: string
  passStatus: 'PASS' | 'FAIL' | 'IN_PROGRESS' | 'PENDING'
  passLabel: string
  verifiedAt: string | null
  note: string
  evidence: EvidenceAttachment[]
  pendingRiskSignal: PendingRiskSignal | null
  upgradedRisk: UpgradedRiskRef | null
}

export interface RampRow {
  id: number
  order: number
  phase: string
  loadRate: number
  targetCapacity: number
  plannedPeriod: string
  confirmedAt: string | null
  actualCapacity: number | null
  status: 'PASS' | 'FAIL' | 'IN_PROGRESS' | 'PENDING'
  statusLabel: string
  note: string
  evidence: EvidenceAttachment[]
  pendingRiskSignal: PendingRiskSignal | null
  upgradedRisk: UpgradedRiskRef | null
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
  planId: string
  targetKind: 'plan' | 'item' | 'approval' | 'commissioning' | 'ramp'
  targetId: number | null
  name: string
  fileName: string
  url: string
  mimeType: string
  size: number
  note: string
  uploadedAt: string
  uploadedById: string
  uploadedByRole: string
  requiresVerification: boolean
  verificationStatus: EvidenceVerificationStatus
  verifiedById: string | null
  verifiedAt: string | null
  verifiedNote: string
}

export interface EvidenceNode {
  kind: 'plan' | 'item' | 'approval' | 'commissioning' | 'ramp'
  targetId: number | null
  label: string
  evidence: EvidenceItem[]
}

export interface EvidencePlanGroup {
  planId: string
  planName: string
  supplierName: string
  nodes: EvidenceNode[]
  evidenceCount: number
}

export interface ExpansionEvidencePayload {
  board: string
  view: string
  generatedAt: string
  kpis: Kpi[]
  planGroups: EvidencePlanGroup[]
}

export interface RiskRow {
  id: string
  type: RiskTypeKey | string
  typeLabel: string
  level: RiskLevel
  status: string
  description: string
  impactScope: string
  materialName: string
  supplierName: string
  actionCount: number
  openActionCount: number
  discoveredAt: string
  closedAt: string | null
  sourceKind: RiskSourceKind | null
  sourceId: number | null
  sourcePlanId: string | null
  source: RiskSource | null
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

export type EvidenceTarget =
  | { kind: 'plan'; planId: string; planName: string }
  | { kind: 'item'; planId: string; planName: string; targetId: number; targetLabel: string }
  | { kind: 'approval'; planId: string; planName: string; targetId: number; targetLabel: string }
  | { kind: 'commissioning'; planId: string; planName: string; targetId: number; targetLabel: string }
  | { kind: 'ramp'; planId: string; planName: string; targetId: number; targetLabel: string }

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