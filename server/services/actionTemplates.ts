export interface ActionTemplate {
  type: string
  title: string
  description: string
}

export const actionTemplates: Record<string, ActionTemplate[]> = {
  SINGLE_SOURCE: [
    { type: 'SOURCING', title: '启动备份供应商寻源', description: '建立至少 2 家候选供应商清单，完成资质初审与送样计划。' },
    { type: 'STOCK', title: '提升安全库存', description: '将关键物料安全库存提升至 3-6 个月，并锁定仓储与资金方案。' },
    { type: 'EXPANSION', title: '推动主供应商扩产', description: '联合主供应商启动二期/三期扩产计划，明确产能新增与时间节点。' },
    { type: 'OTHER', title: '建立战略联盟', description: '与核心供应商签署产能优先保障与风险共担协议。' },
  ],
  LOW_INVENTORY: [
    { type: 'STOCK', title: '紧急备货', description: '锁定现货资源，补充至不少于 1 个月安全库存。' },
    { type: 'TRANSFER', title: '跨区域调拨', description: '盘点各区域库存并组织跨仓调拨，优先保障关键排产。' },
    { type: 'EXPANSION', title: '推动供应商扩产保供', description: '由采购协同供应商启动新增产能计划，纳入扩产跟踪。' },
    { type: 'OTHER', title: '加速交付', description: '与供应商确认加急排产和分批交付方案。' },
  ],
  PRICE: [
    { type: 'PRICE_LOCK', title: '签订锁价长协', description: '对未来季度核心需求签订价格锁定补充协议。' },
    { type: 'INSURANCE', title: '评估套保方案', description: '联合财务评估套期保值比例、成本与风险边界。' },
    { type: 'SOURCING', title: '推进替代料验证', description: '启动低成本替代料送样、验证和切换评审。' },
  ],
  POLICY: [
    { type: 'SOURCING', title: '推进多源化', description: '开发不受相关政策限制的国产或其他区域供应源。' },
    { type: 'CONTRACT', title: '开展合规审查', description: '完成出口管制、制裁与最终用途合规审查。' },
    { type: 'OTHER', title: '制定政策应急预案', description: '明确受限后的替代来源、库存策略与升级机制。' },
  ],
  QUALITY: [
    { type: 'OTHER', title: '要求 8D 报告', description: '要求供应商按时提交 8D，并追踪永久纠正措施。' },
    { type: 'OTHER', title: '开展现场审计', description: '组织质量、采购和研发进行联合现场过程审计。' },
    { type: 'SOURCING', title: '切换合格批次', description: '隔离异常批次，验证并切换至合格批次或备份来源。' },
  ],
}

export function templatesFor(type: string) {
  return actionTemplates[type] ?? [
    { type: 'OTHER', title: '制定专项措施', description: '明确责任人、节点、交付标准与升级机制。' },
  ]
}