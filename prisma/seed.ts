import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUPPLIERS = [
  { id: 'S_GANFENG', code: 'GF-LI', name: '赣锋锂业股份有限公司', shortName: '赣锋锂业', category: '正极', contact: '刘经理 / 13800001001', location: '江西宜春', cooperationYears: 8 },
  { id: 'S_YUNENG', code: 'YN-LFP', name: '湖南裕能新能源电池材料有限公司', shortName: '裕能', category: '正极', contact: '周经理 / 13800001002', location: '湖南湘潭', cooperationYears: 5 },
  { id: 'S_RONGBAI', code: 'RB-NCM', name: '宁波容百新能源科技股份有限公司', shortName: '容百', category: '正极', contact: '吴经理 / 13800001003', location: '浙江宁波', cooperationYears: 4 },
  { id: 'S_BEITERUI', code: 'BT-GR', name: '贝特瑞新材料集团股份有限公司', shortName: '贝特瑞', category: '负极', contact: '钱经理 / 13800001004', location: '广东深圳', cooperationYears: 6 },
  { id: 'S_DUOFUDUO', code: 'DFD-6F', name: '多氟多新材料股份有限公司', shortName: '多氟多', category: '电解液', contact: '孙经理 / 13800001005', location: '河南焦作', cooperationYears: 3 },
]

const USERS = [
  { id: 'U_MANAGER', name: '张敏', role: 'PROCUREMENT_MANAGER', title: '采购经理' },
  { id: 'U_ENGINEER1', name: '李伟', role: 'PROCUREMENT_ENGINEER', title: '采购工程师 · 正极' },
  { id: 'U_ENGINEER2', name: '王芳', role: 'PROCUREMENT_ENGINEER', title: '采购工程师 · 负极/电解液' },
  { id: 'U_LEADER', name: '陈志强', role: 'DEPARTMENT_LEADER', title: '供应链部门总' },
  { id: 'U_SUPPLIER_GF', name: '刘建军', role: 'SUPPLIER', title: '赣锋接口人', supplierId: 'S_GANFENG' },
  { id: 'U_SUPPLIER_YN', name: '周亚琴', role: 'SUPPLIER', title: '裕能接口人', supplierId: 'S_YUNENG' },
  { id: 'U_SUPPLIER_RB', name: '吴东海', role: 'SUPPLIER', title: '容百接口人', supplierId: 'S_RONGBAI' },
  { id: 'U_SUPPLIER_BT', name: '钱明远', role: 'SUPPLIER', title: '贝特瑞接口人', supplierId: 'S_BEITERUI' },
  { id: 'U_SUPPLIER_DFD', name: '孙鹏飞', role: 'SUPPLIER', title: '多氟多接口人', supplierId: 'S_DUOFUDUO' },
]

const now = new Date()
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000)
const daysAhead = (d: number) => new Date(now.getTime() + d * 86_400_000)
const monthsAgo = (m: number) => new Date(now.getTime() - m * 30 * 86_400_000)
const monthsAhead = (m: number) => new Date(now.getTime() + m * 30 * 86_400_000)

const MATERIALS = [
  { id: 'M001', name: '电池级碳酸锂', type: '正极', supplierId: 'S_GANFENG', demandMonthly: 800, supplyMonthly: 520, inventory: 240, safetyStockMonths: 2.5, singleSource: true, dependenceLevel: '独家', riskDescription: '单一供应商独家供货，安全库存仅 2.5 个月用量。' },
  { id: 'M002', name: '磷酸铁锂 LFP', type: '正极', supplierId: 'S_YUNENG', demandMonthly: 1500, supplyMonthly: 1100, inventory: 480, safetyStockMonths: 2.0, singleSource: true, dependenceLevel: '主供', riskDescription: '主供占比超 70%，库存不足 1 个月等量覆盖。' },
  { id: 'M003', name: '三元 NCM811', type: '正极', supplierId: 'S_RONGBAI', demandMonthly: 600, supplyMonthly: 380, inventory: 90, safetyStockMonths: 3.0, singleSource: true, dependenceLevel: '独家', riskDescription: '独家供货 + 产能技改延期，对 811 系列电芯排产有影响。' },
  { id: 'M004', name: '人造石墨负极', type: '负极', supplierId: 'S_BEITERUI', demandMonthly: 900, supplyMonthly: 870, inventory: 1620, safetyStockMonths: 3.0, singleSource: true, dependenceLevel: '主供', riskDescription: '石墨化炉到货延迟，已要求主供增加第二供应商。' },
  { id: 'M005', name: '6F 电解液', type: '电解液', supplierId: 'S_DUOFUDUO', demandMonthly: 450, supplyMonthly: 460, inventory: 380, safetyStockMonths: 2.5, singleSource: false, dependenceLevel: null, riskDescription: '替代料验证中，下月可能切换到二供。' },
  { id: 'M006', name: 'PVDF 粘结剂', type: '辅材', supplierId: 'S_DUOFUDUO', demandMonthly: 120, supplyMonthly: 105, inventory: 95, safetyStockMonths: 2.0, singleSource: true, dependenceLevel: '主供', riskDescription: '受锂电 PVDF 出口政策影响，已启动国产替代验证。' },
  { id: 'M007', name: '湿法隔膜', type: '隔膜', supplierId: 'S_RONGBAI', demandMonthly: 720, supplyMonthly: 720, inventory: 1100, safetyStockMonths: 3.0, singleSource: false, dependenceLevel: null, riskDescription: '供应稳定，库存充足。' },
  { id: 'M008', name: '导电剂 SP', type: '辅材', supplierId: 'S_BEITERUI', demandMonthly: 35, supplyMonthly: 35, inventory: 60, safetyStockMonths: 2.0, singleSource: false, dependenceLevel: null, riskDescription: '供应稳定。' },
  { id: 'M009', name: '羧甲基纤维素 CMC', type: '辅材', supplierId: 'S_DUOFUDUO', demandMonthly: 22, supplyMonthly: 22, inventory: 40, safetyStockMonths: 2.0, singleSource: false, dependenceLevel: null, riskDescription: '供应稳定。' },
  { id: 'M010', name: '电池铝箔', type: '辅材', supplierId: 'S_RONGBAI', demandMonthly: 280, supplyMonthly: 280, inventory: 480, safetyStockMonths: 3.0, singleSource: false, dependenceLevel: null, riskDescription: '供应稳定。' },
]

const RISKS = [
  { id: 'R001', materialId: 'M001', type: 'SINGLE_SOURCE', level: 'RED', description: '电池级碳酸锂独家依赖赣锋锂业，无备份供应商且库存仅 0.3 个月覆盖。', impactScope: '314Ah 储能电芯、5MWh 长时储能系统项目', status: 'IN_PROGRESS' },
  { id: 'R002', materialId: 'M002', type: 'LOW_INVENTORY', level: 'ORANGE', description: '磷酸铁锂库存 0.3 个月覆盖，3 月份排产缺口 400 吨/月。', impactScope: 'LF280K 储能电芯、5MWh 储能集装箱', status: 'IN_PROGRESS' },
  { id: 'R003', materialId: 'M001', type: 'PRICE', level: 'ORANGE', description: '电池级碳酸锂 Q3 长协价格较 Q2 上涨 18%，超出预算 12%。', impactScope: '全系含锂电芯 BOM 成本', status: 'PENDING' },
  { id: 'R004', materialId: 'M006', type: 'POLICY', level: 'YELLOW', description: 'PVDF 受锂电出口管制审查影响，海外产能交付存在不确定。', impactScope: '海外项目出货节奏', status: 'PENDING' },
  { id: 'R005', materialId: 'M004', type: 'QUALITY', level: 'ORANGE', description: '近期到货批次 D50 粒径偏离工艺窗口，已要求供应商 8D。', impactScope: '低温系列产品', status: 'IN_PROGRESS' },
  { id: 'R006', materialId: 'M003', type: 'SINGLE_SOURCE', level: 'RED', description: '三元 NCM811 仅容百一家独家，技改延期直接影响 Q3 出货。', impactScope: '高镍电芯系列、出口订单', status: 'PENDING' },
  { id: 'R007', materialId: 'M005', type: 'LOW_INVENTORY', level: 'YELLOW', description: '6F 电解液安全库存逼近红线，需关注 Q3 长协覆盖。', impactScope: '全系电芯', status: 'PENDING' },
  { id: 'R008', materialId: 'M001', type: 'PRICE', level: 'ORANGE', description: '锂矿拍卖价格异常波动，可能传导至下游碳酸锂。', impactScope: '锂盐系列', status: 'PENDING' },
]

const ACTIONS = [
  { id: 'A001', riskId: 'R001', type: 'SOURCING', description: '启动备份供应商寻源：完成 2 家候选资质初审，6 月内送样。', recommenderId: 'U_MANAGER', ownerId: 'U_ENGINEER1', startDate: daysAgo(8), deadline: daysAhead(25), priority: 'P0' },
  { id: 'A002', riskId: 'R002', type: 'STOCK', description: '紧急备货 500 吨 LFP，对接裕能锁定 6 月产能配额。', recommenderId: 'U_MANAGER', ownerId: 'U_ENGINEER1', startDate: daysAgo(5), deadline: daysAhead(10), priority: 'P0' },
  { id: 'A003', riskId: 'R003', type: 'PRICE_LOCK', description: '与赣锋签订 Q3 锁价长协补充协议，覆盖 70% 用量。', recommenderId: 'U_MANAGER', ownerId: 'U_ENGINEER1', startDate: daysAgo(3), deadline: daysAhead(3), priority: 'P1' },
  { id: 'A004', riskId: 'R004', type: 'SOURCING', description: '推进国产 PVDF 多源化：3 家国产供应商送样与验证。', recommenderId: 'U_MANAGER', ownerId: 'U_ENGINEER2', startDate: daysAgo(15), deadline: daysAgo(2), priority: 'P1' },
  { id: 'A005', riskId: 'R005', type: 'OTHER', description: '要求贝特瑞提交 8D 报告并配合现场审计。', recommenderId: 'U_ENGINEER2', ownerId: 'U_ENGINEER2', startDate: daysAgo(20), deadline: daysAgo(30), priority: 'P2' },
]

const PLANS = [
  // RED: 滞后>30%
  { id: 'P001', materialId: 'M001', supplierId: 'S_GANFENG', name: '二期 3 万吨电池级碳酸锂扩产', startDate: monthsAgo(10), endDate: monthsAhead(2), targetCapacity: 30000, investedCapex: 38000, totalCapex: 65000, fundingSources: ['自有', '贷款'], stage: '安装', progress: 38, status: 'RED', riskTypes: ['设备', '资金'], riskDescription: '窑炉设备延期到货 + 银行放款节奏慢于预期。' },
  // ORANGE: 滞后 10-30%
  { id: 'P002', materialId: 'M002', supplierId: 'S_YUNENG', name: '三期 8 万吨 LFP 扩产', startDate: monthsAgo(8), endDate: monthsAhead(4), targetCapacity: 80000, investedCapex: 42000, totalCapex: 88000, fundingSources: ['自有', '融资'], stage: '调试', progress: 52, status: 'ORANGE', riskTypes: ['设备'], riskDescription: '砂磨机调试周期超预期，工艺验证仍在迭代。' },
  // YELLOW: 滞后 1-10%
  { id: 'P003', materialId: 'M003', supplierId: 'S_RONGBAI', name: '高镍三元产线技改', startDate: monthsAgo(6), endDate: monthsAhead(3), targetCapacity: 18000, investedCapex: 12000, totalCapex: 15000, fundingSources: ['自有'], stage: '采购设备', progress: 35, status: 'YELLOW', riskTypes: ['物料'], riskDescription: '前驱体供应节奏影响调试排期。' },
  // GREEN
  { id: 'P004', materialId: 'M004', supplierId: 'S_BEITERUI', name: '云南 5 万吨石墨化扩产', startDate: monthsAgo(7), endDate: monthsAhead(5), targetCapacity: 50000, investedCapex: 28000, totalCapex: 36000, fundingSources: ['自有', '补贴'], stage: '调试', progress: 72, status: 'GREEN', riskTypes: [], riskDescription: '进度按计划推进。' },
  // GREEN
  { id: 'P005', materialId: 'M005', supplierId: 'S_DUOFUDUO', name: '2 万吨 6F 电解液扩产', startDate: monthsAgo(5), endDate: monthsAhead(6), targetCapacity: 20000, investedCapex: 15000, totalCapex: 22000, fundingSources: ['贷款'], stage: '采购设备', progress: 45, status: 'GREEN', riskTypes: [], riskDescription: '进度按计划推进。' },
]

const PLAN_ITEMS = [
  { planId: 'P001', type: '设备', name: '回转窑 1#', vendor: '江苏鹏飞', orderNo: 'PF-2025-0312', expectedArrival: monthsAgo(2), actualArrival: daysAgo(10), status: '已到货', delayDays: 10 },
  { planId: 'P001', type: '设备', name: '回转窑 2#', vendor: '江苏鹏飞', orderNo: 'PF-2025-0313', expectedArrival: monthsAgo(1), actualArrival: null, status: '部分到货', delayDays: 30 },
  { planId: 'P001', type: '物料', name: '工业级碳酸锂原料', vendor: '海外长协', orderNo: 'LA-2026-Q2', expectedArrival: monthsAhead(1), actualArrival: null, status: '已签', delayDays: 0 },
  { planId: 'P002', type: '设备', name: '砂磨机 1#', vendor: '德国耐驰', orderNo: 'NE-2026-001', expectedArrival: monthsAgo(3), actualArrival: monthsAgo(1), status: '已调试', delayDays: 0 },
  { planId: 'P002', type: '设备', name: '砂磨机 2#', vendor: '德国耐驰', orderNo: 'NE-2026-002', expectedArrival: monthsAgo(1), actualArrival: null, status: '部分到货', delayDays: 25 },
  { planId: 'P003', type: '设备', name: '烧结炉', vendor: '苏州博华', orderNo: 'BH-2026-008', expectedArrival: monthsAhead(2), actualArrival: null, status: '已签', delayDays: 0 },
  { planId: 'P004', type: '设备', name: '石墨化炉 1#', vendor: '湖南顶立', orderNo: 'DL-2026-005', expectedArrival: monthsAgo(2), actualArrival: monthsAgo(2), status: '已投产', delayDays: 0 },
  { planId: 'P005', type: '设备', name: '反应釜 1#', vendor: '江苏乐科', orderNo: 'LK-2026-001', expectedArrival: monthsAhead(1), actualArrival: null, status: '已签', delayDays: 0 },
]

const EVIDENCE = [
  { planId: 'P001', category: 'DEVICE_PHOTO', fileName: '窑炉1号到货验收.jpg', mimeType: 'image/jpeg', note: '回转窑 1# 到货验收现场' },
  { planId: 'P001', category: 'CONTRACT', fileName: '鹏飞采购合同.pdf', mimeType: 'application/pdf', note: '江苏鹏飞采购合同正本' },
  { planId: 'P002', category: 'PAYMENT', fileName: '耐驰设备付款凭证.pdf', mimeType: 'application/pdf', note: '砂磨机 1# 尾款付款凭证' },
  { planId: 'P002', category: 'TEST_REPORT', fileName: '工艺验证报告v2.pdf', mimeType: 'application/pdf', note: 'LFP 工艺验证第二轮报告' },
  { planId: 'P004', category: 'SITE_PHOTO', category2: undefined, fileName: '云南石墨化炉现场.jpg', mimeType: 'image/jpeg', note: '石墨化炉 1# 投产现场' },
  { planId: 'P005', category: 'CONTRACT', fileName: '江苏乐科采购合同.pdf', mimeType: 'application/pdf', note: '反应釜采购合同' },
] as Array<{ planId: string; category: string; category2?: undefined; fileName: string; mimeType: string; note: string }>

const NOTIFICATIONS = [
  { userId: 'U_MANAGER', type: 'RISK_ESCALATION', level: 'ORANGE', title: '风险 R001 升级提醒', message: '电池级碳酸锂安全库存仅 0.3 个月，需立即升级处理。', link: '/board/risks/view/overview?risk=R001' },
  { userId: 'U_MANAGER', type: 'TASK_REMINDER', level: 'YELLOW', title: '措施 A003 即将到期', message: '锁价长协谈判还有 3 天到期，请尽快跟进。', link: '/board/tasks/view/my-todo?task=T003' },
  { userId: 'U_ENGINEER1', type: 'TASK_OVERDUE', level: 'ORANGE', title: '措施 A004 已逾期', message: '国产 PVDF 多源化验证已逾期 2 天，请尽快补交进度。', link: '/board/tasks/view/overdue?task=T004' },
  { userId: 'U_LEADER', type: 'RISK_ESCALATION', level: 'RED', title: '高风险预警', message: 'R001 电池级碳酸锂风险已升级为红色，建议委员会介入。', link: '/board/risks/view/escalation' },
  { userId: 'U_ENGINEER1', type: 'EVIDENCE_UPDATE', level: 'GREEN', title: '新证据上传', message: '赣锋接口人上传了窑炉到货验收照片。', link: '/board/expansion/view/evidence?plan=P001' },
  { userId: 'U_ENGINEER2', type: 'TASK_REMINDER', level: 'YELLOW', title: '措施 A005 已闭环', message: '贝特瑞 8D 报告已通过审核，措施闭环。', link: '/board/tasks/view/closure' },
  { userId: 'U_MANAGER', type: 'PLAN_REVIEW', level: 'GREEN', title: '扩产计划状态更新', message: 'P004 云南石墨化扩产进度更新至 72%。', link: '/board/expansion/view/overview?plan=P004' },
  { userId: 'U_LEADER', type: 'BENCHMARK', level: 'GREEN', title: '横向对比更新', message: '5 家供应商本期扩产横向对比已生成。', link: '/board/expansion/view/benchmark' },
]

async function main() {
  console.log('开始清空旧数据…')
  await prisma.notification.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.taskUpdate.deleteMany()
  await prisma.taskCollaborator.deleteMany()
  await prisma.followTask.deleteMany()
  await prisma.action.deleteMany()
  await prisma.risk.deleteMany()
  await prisma.evidenceChain.deleteMany()
  await prisma.expansionItem.deleteMany()
  await prisma.expansionPlan.deleteMany()
  await prisma.material.deleteMany()
  await prisma.user.deleteMany()
  await prisma.supplier.deleteMany()

  console.log('写入供应商…')
  for (const s of SUPPLIERS) {
    await prisma.supplier.create({ data: { ...s } })
  }

  console.log('写入用户…')
  for (const u of USERS) {
    await prisma.user.create({ data: { ...u } })
  }

  console.log('写入物料（仅作背景）…')
  for (const m of MATERIALS) {
    await prisma.material.create({ data: { ...m, ownerId: m.singleSource ? 'U_ENGINEER1' : 'U_ENGINEER2' } })
  }

  console.log('写入风险…')
  for (const r of RISKS) {
    await prisma.risk.create({
      data: {
        ...r,
        creatorId: 'U_ENGINEER1',
        discoveredAt: daysAgo(20),
      },
    })
  }

  console.log('写入措施…')
  for (const a of ACTIONS) {
    await prisma.action.create({ data: { ...a } })
  }

  console.log('写入任务与进度更新…')
  // T001-A001 进行中 60%
  await prisma.followTask.create({
    data: {
      id: 'T001',
      actionId: 'A001',
      title: '备份供应商寻源 · 资质初审',
      ownerId: 'U_ENGINEER1',
      startDate: daysAgo(8),
      deadline: daysAhead(25),
      progress: 60,
      status: 'IN_PROGRESS',
      progressDescription: '已完成 2 家候选供应商资质初审。',
    },
  })
  await prisma.taskUpdate.create({
    data: { taskId: 'T001', progress: 30, description: '梳理候选供应商短名单 5 家。', authorId: 'U_ENGINEER1' },
  })
  await prisma.taskUpdate.create({
    data: { taskId: 'T001', progress: 60, description: '完成 2 家资质初审，约定下周送样。', authorId: 'U_ENGINEER1', createdAt: daysAgo(2) },
  })

  // T002-A002 进行中 40%
  await prisma.followTask.create({
    data: {
      id: 'T002',
      actionId: 'A002',
      title: '紧急备货 500 吨 LFP',
      ownerId: 'U_ENGINEER1',
      startDate: daysAgo(5),
      deadline: daysAhead(10),
      progress: 40,
      status: 'IN_PROGRESS',
      progressDescription: '已锁定 6 月 200 吨产能配额。',
    },
  })
  await prisma.taskUpdate.create({
    data: { taskId: 'T002', progress: 40, description: '裕能确认 6 月优先排产 200 吨。', authorId: 'U_ENGINEER1', createdAt: daysAgo(2) },
  })

  // T003-A003 即将到期（3天）
  await prisma.followTask.create({
    data: {
      id: 'T003',
      actionId: 'A003',
      title: '签订 Q3 锁价长协补充协议',
      ownerId: 'U_ENGINEER1',
      startDate: daysAgo(3),
      deadline: daysAhead(3),
      progress: 70,
      status: 'IN_PROGRESS',
      progressDescription: '价格条款已谈妥，等待法务终审。',
    },
  })

  // T004-A004 已逾期 2 天
  await prisma.followTask.create({
    data: {
      id: 'T004',
      actionId: 'A004',
      title: '国产 PVDF 多源化验证',
      ownerId: 'U_ENGINEER2',
      startDate: daysAgo(15),
      deadline: daysAgo(2),
      progress: 50,
      status: 'OVERDUE',
      progressDescription: '送样完成 2 家，待第三家送样中。',
    },
  })
  await prisma.taskUpdate.create({
    data: { taskId: 'T004', progress: 50, description: '2 家国产 PVDF 送样工艺验证中。', authorId: 'U_ENGINEER2', createdAt: daysAgo(5) },
  })

  // T005-A005 已闭环
  await prisma.followTask.create({
    data: {
      id: 'T005',
      actionId: 'A005',
      title: '贝特瑞 8D 报告与现场审计',
      ownerId: 'U_ENGINEER2',
      startDate: daysAgo(20),
      deadline: daysAgo(5),
      progress: 100,
      status: 'COMPLETED',
      progressDescription: '8D 报告已通过审核，现场审计完成。',
      closedAt: daysAgo(2),
    },
  })
  await prisma.taskUpdate.create({
    data: { taskId: 'T005', progress: 100, description: '完成现场审计，问题闭环。', authorId: 'U_ENGINEER2', createdAt: daysAgo(2) },
  })
  await prisma.attachment.create({
    data: {
      taskId: 'T005',
      category: 'TEST_REPORT',
      fileName: '贝特瑞8D报告.pdf',
      storedName: 'T005-8d-report.pdf',
      mimeType: 'application/pdf',
      size: 1843200,
      url: '/uploads/T005-8d-report.pdf',
      uploadedById: 'U_ENGINEER2',
    },
  })

  console.log('写入扩产计划与设备清单…')
  for (const p of PLANS) {
    await prisma.expansionPlan.create({
      data: {
        ...p,
        fundingSources: p.fundingSources,
        riskTypes: p.riskTypes,
        ownerId: 'U_ENGINEER1',
        expectedProgress: 50,
        updatedAt: daysAgo(2),
      },
    })
  }
  for (const item of PLAN_ITEMS) {
    await prisma.expansionItem.create({ data: item })
  }

  console.log('写入证据链…')
  for (const e of EVIDENCE) {
    await prisma.evidenceChain.create({
      data: {
        planId: e.planId,
        category: e.category,
        fileName: e.fileName,
        storedName: `${e.planId}-${e.fileName}`,
        mimeType: e.mimeType,
        size: 1024000,
        url: `/uploads/${e.planId}-${e.fileName}`,
        note: e.note,
        uploadedById: e.planId === 'P001' || e.planId === 'P002' ? 'U_SUPPLIER_GF' : 'U_SUPPLIER_BT',
        uploadedAt: daysAgo(2),
      },
    })
  }

  console.log('写入通知…')
  for (const n of NOTIFICATIONS) {
    await prisma.notification.create({
      data: {
        ...n,
        message: n.message,
        link: n.link,
        createdAt: daysAgo(1),
      },
    })
  }

  console.log('\nSeed 完成：')
  console.log(`  供应商 ${SUPPLIERS.length}, 用户 ${USERS.length}`)
  console.log(`  物料 ${MATERIALS.length}（仅背景）, 风险 ${RISKS.length}, 措施 ${ACTIONS.length}, 任务 5`)
  console.log(`  扩产计划 ${PLANS.length}（1 红 1 橙 1 黄 2 绿）, 设备清单 ${PLAN_ITEMS.length}, 证据 ${EVIDENCE.length}`)
  console.log(`  通知 ${NOTIFICATIONS.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())