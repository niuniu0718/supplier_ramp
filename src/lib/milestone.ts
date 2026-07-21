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
  deliverables: string
}

export const MILESTONE_TEMPLATE: MilestoneTemplate[] = [
  {
    order: 1, key: 'FEASIBILITY', name: '需求确认与可行性研究', icon: FileCheck,
    deliverables: '可研报告 / 市场预测',
  },
  {
    order: 2, key: 'EIA', name: '项目立项与审批', icon: Leaf,
    deliverables: '投资批复 / 立项文件 / 双方盖章版《产能承诺书》',
  },
  {
    order: 3, key: 'EQUIPMENT_ORDER', name: '工艺设计与工程', icon: ShoppingCart,
    deliverables: '基础设计 / 详细设计',
  },
  {
    order: 4, key: 'CIVIL', name: '关键审批与设备', icon: HardHat,
    deliverables:
      '政府审批许可：环评批复、安评批复、排污许可、危险化学品生产许可、建设用地规划许可、节能审查\n核心设备：全套生产设备提前采购订单、到货确认单、设备合格证',
  },
  {
    order: 5, key: 'EQUIPMENT_DELIVERY', name: '施工建设与安装', icon: Truck,
    deliverables:
      '厂房、仓储、环保配套土建竣工验收单及现场照片\n全套生产设备安装验收单',
  },
  {
    order: 6, key: 'INSTALLATION', name: '试产验证与考核', icon: Wrench,
    deliverables: '试产报告 / 72h 满负荷考核报告',
  },
  {
    order: 7, key: 'TRIAL_PRODUCTION', name: '客户认证与审核', icon: FlaskConical,
    deliverables: '样品检测报告 / CATL 变更现场审核通过报告',
  },
  {
    order: 8, key: 'FULL_PRODUCTION', name: '量产爬坡与优化', icon: Factory,
    deliverables: '爬坡计划 / OEE 数据',
  },
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