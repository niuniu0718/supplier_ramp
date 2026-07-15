import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
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
  { order: 1, key: 'FEASIBILITY', name: '立项批复', icon: FileCheck },
  { order: 2, key: 'EIA', name: '环评安评', icon: Leaf },
  { order: 3, key: 'EQUIPMENT_ORDER', name: '设备采购签约', icon: ShoppingCart },
  { order: 4, key: 'CIVIL', name: '土建竣工', icon: HardHat },
  { order: 5, key: 'EQUIPMENT_DELIVERY', name: '设备到货', icon: Truck },
  { order: 6, key: 'INSTALLATION', name: '安装调试', icon: Wrench },
  { order: 7, key: 'TRIAL_PRODUCTION', name: '试生产', icon: FlaskConical },
  { order: 8, key: 'FULL_PRODUCTION', name: '正式投产', icon: Factory },
]

export const MILESTONE_BY_KEY: Record<string, MilestoneTemplate> = Object.fromEntries(
  MILESTONE_TEMPLATE.map((m) => [m.key, m]),
)

export const MILESTONE_STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; ring: string; tone: 'done' | 'progress' | 'pending' | 'overdue' }
> = {
  已投产: { label: '已投产', color: 'var(--green)', bg: '#e6f8f1', ring: '#18a875', tone: 'done' },
  已调试: { label: '已调试', color: 'var(--green)', bg: '#e6f8f1', ring: '#18a875', tone: 'done' },
  已完成: { label: '已完成', color: 'var(--green)', bg: '#e6f8f1', ring: '#18a875', tone: 'done' },
  已到货: { label: '已到货', color: 'var(--green)', bg: '#e6f8f1', ring: '#18a875', tone: 'done' },
  进行中: { label: '进行中', color: 'var(--orange)', bg: '#fff0e3', ring: '#ef7d32', tone: 'progress' },
  部分到货: { label: '部分到货', color: 'var(--orange)', bg: '#fff0e3', ring: '#ef7d32', tone: 'progress' },
  已签: { label: '已签合同', color: 'var(--primary)', bg: '#e0eaff', ring: '#2563eb', tone: 'pending' },
  待开始: { label: '待开始', color: 'var(--text-muted)', bg: '#eef2f7', ring: '#9ca3af', tone: 'pending' },
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