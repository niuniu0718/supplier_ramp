import {
  Factory,
  FileCheck,
  FlaskConical,
  HardHat,
  Leaf,
  ShoppingCart,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export interface MilestoneTemplate {
  order: number
  key: string
  name: string
  icon: LucideIcon
}

export const MILESTONE_TEMPLATE: MilestoneTemplate[] = [
  { order: 1, key: 'FEASIBILITY', name: '需求确认与可行性研究', icon: FileCheck },
  { order: 2, key: 'EIA', name: '项目立项与审批', icon: Leaf },
  { order: 3, key: 'EQUIPMENT_ORDER', name: '工艺设计与工程', icon: ShoppingCart },
  { order: 4, key: 'CIVIL', name: '政府审批与许可', icon: HardHat },
  { order: 5, key: 'EQUIPMENT_DELIVERY', name: '施工建设与安装', icon: Truck },
  { order: 6, key: 'INSTALLATION', name: '试车验证与考核', icon: Wrench },
  { order: 7, key: 'TRIAL_PRODUCTION', name: '客户认证与审核', icon: FlaskConical },
  { order: 8, key: 'FULL_PRODUCTION', name: '量产爬坡与优化', icon: Factory },
]

export const MILESTONE_BY_KEY: Record<string, MilestoneTemplate> = Object.fromEntries(
  MILESTONE_TEMPLATE.map((m) => [m.key, m]),
)

export const MILESTONE_STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; ring: string; tone: 'done' | 'progress' | 'pending' | 'overdue' }
> = {
  已完成: { label: '已完成', color: 'var(--green)', bg: '#e6f8f1', ring: '#18a875', tone: 'done' },
  进行中: { label: '进行中', color: 'var(--orange)', bg: '#fff0e3', ring: '#ef7d32', tone: 'progress' },
  未开始: { label: '未开始', color: 'var(--text-muted)', bg: '#eef2f7', ring: '#9ca3af', tone: 'pending' },
  待开始: { label: '未开始', color: 'var(--text-muted)', bg: '#eef2f7', ring: '#9ca3af', tone: 'pending' },
  已逾期: { label: '已逾期', color: 'var(--red)', bg: '#ffe4e0', ring: '#dc3f4c', tone: 'overdue' },
}

export function milestoneStatusMeta(status: string) {
  return MILESTONE_STATUS_META[status] ?? {
    label: status,
    color: 'var(--text-muted)',
    bg: '#eef2f7',
    ring: '#9ca3af',
    tone: 'pending' as const,
  }
}