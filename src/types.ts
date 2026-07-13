export type RiskLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'
export type UserRole = 'PROCUREMENT_ENGINEER' | 'PROCUREMENT_MANAGER' | 'DEPARTMENT_LEADER' | 'SUPPLIER'

export interface User {
  id: string
  name: string
  role: UserRole
  title: string
  avatarColor: string
  supplierId: string | null
  supplier?: { shortName: string } | null
}

export interface Supplier {
  id: string
  code: string
  name: string
  shortName: string
  category: string
  contact: string
  location: string
}

export interface Material {
  id: string
  name: string
  type: string
  supplierId: string
  supplier: Supplier
  demandMonthly: number
  supplyMonthly: number
  inventory: number
  safetyStockMonths: number
  singleSource: boolean
  dependenceLevel: string | null
  riskLevel: RiskLevel
  riskDescription: string
  supplyGap: number
  gapRatio: number
  actionCount: number
  updatedAt: string
  risks?: Risk[]
  expansionPlans?: ExpansionPlan[]
}

export interface ActionTemplate {
  type: string
  title: string
  description: string
}

export interface Action {
  id: string
  type: string
  description: string
  deadline: string
  priority: string
  status: string
  completion: number
  owner: Pick<User, 'id' | 'name' | 'title'>
  task?: FollowTask | null
}

export interface Risk {
  id: string
  materialId: string
  material: Material
  type: string
  level: RiskLevel
  description: string
  impactScope: string
  discoveredAt: string
  status: string
  isAuto: boolean
  actions: Action[]
  templates?: ActionTemplate[]
}

export interface TaskUpdate {
  id: number
  progress: number
  description: string
  createdAt: string
  author: Pick<User, 'id' | 'name'>
}

export interface Attachment {
  id: number
  fileName: string
  mimeType: string
  size: number
  url: string
  createdAt: string
  uploadedBy?: Pick<User, 'id' | 'name'>
}

export interface FollowTask {
  id: string
  title: string
  ownerId: string
  owner: Pick<User, 'id' | 'name' | 'title' | 'avatarColor'>
  collaboratorNames: string
  startDate: string
  deadline: string
  progress: number
  status: string
  progressDescription: string
  closedAt: string | null
  updatedAt: string
  action: Action & { risk: Risk }
  updates: TaskUpdate[]
  attachments: Attachment[]
}

export interface ExpansionItem {
  id: number
  type: string
  name: string
  vendor: string
  orderNo: string
  expectedArrival: string
  actualArrival: string | null
  status: string
  delayDays: number
  note: string
}

export interface ExpansionPlan {
  id: string
  name: string
  materialId: string
  material: Material
  supplierId: string
  supplier: Supplier
  startDate: string
  endDate: string
  targetCapacity: number
  investedCapex: number
  totalCapex: number
  fundingSources: string[]
  stage: string
  progress: number
  expectedProgress: number
  lag: number
  status: RiskLevel
  riskTypes: string[]
  riskDescription: string
  owner: Pick<User, 'id' | 'name' | 'title'>
  items: ExpansionItem[]
  updatedAt: string
}

export interface DashboardData {
  summary: {
    materialCount: number
    supplierCount: number
    demandTotal: number
    supplyTotal: number
    openRiskCount: number
    activeTaskCount: number
    overdueTaskCount: number
    expansionPlanCount: number
    expansionRiskCount: number
  }
  riskCounts: Record<RiskLevel, number>
  typeDistribution: Array<{ type: string } & Record<RiskLevel, number>>
  healthTrend: Array<{ week: string; score: number; date: string }>
  gapAnalysis: Array<{ id: string; name: string; type: string; gap: number }>
  topRisks: Material[]
  materials: Material[]
}

export interface Notification {
  id: number
  type: string
  level: RiskLevel
  title: string
  message: string
  link: string
  isRead: boolean
  createdAt: string
}

export interface ReferenceData {
  suppliers: Supplier[]
  owners: Array<Pick<User, 'id' | 'name' | 'title'>>
}
