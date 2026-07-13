import { PrismaClient } from '@prisma/client'
import { calculateExpansionRisk } from '../server/services/riskEngine.js'

const prisma = new PrismaClient()
const DAY = 86_400_000
const now = new Date()
const dateFromNow = (days: number) => new Date(now.getTime() + days * DAY)

async function main() {
  await prisma.notification.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.taskUpdate.deleteMany()
  await prisma.followTask.deleteMany()
  await prisma.action.deleteMany()
  await prisma.risk.deleteMany()
  await prisma.expansionItem.deleteMany()
  await prisma.expansionPlan.deleteMany()
  await prisma.healthSnapshot.deleteMany()
  await prisma.material.deleteMany()
  await prisma.user.deleteMany()
  await prisma.supplier.deleteMany()

  await prisma.supplier.createMany({
    data: [
      { id: 'S001', code: 'SUP-001', name: '赣锋锂业股份有限公司', shortName: '赣锋锂业', category: '锂盐', contact: '王海', location: '江西·新余', cooperationYears: 6 },
      { id: 'S002', code: 'SUP-002', name: '湖北万润新能源科技股份有限公司', shortName: '湖北万润', category: '正极材料', contact: '赵颖', location: '湖北·十堰', cooperationYears: 4 },
      { id: 'S003', code: 'SUP-003', name: '贝特瑞新材料集团股份有限公司', shortName: '贝特瑞', category: '负极材料', contact: '徐峰', location: '广东·深圳', cooperationYears: 8 },
      { id: 'S004', code: 'SUP-004', name: '广州天赐高新材料股份有限公司', shortName: '天赐材料', category: '电解液', contact: '刘静', location: '广东·广州', cooperationYears: 7 },
      { id: 'S005', code: 'SUP-005', name: '上海恩捷新材料科技有限公司', shortName: '恩捷股份', category: '隔膜', contact: '胡磊', location: '上海', cooperationYears: 5 },
      { id: 'S006', code: 'SUP-006', name: '东岳氟硅科技集团有限公司', shortName: '东岳集团', category: '辅材', contact: '孙梅', location: '山东·淄博', cooperationYears: 3 },
      { id: 'S007', code: 'SUP-007', name: '江苏天奈科技股份有限公司', shortName: '天奈科技', category: '辅材', contact: '郑宇', location: '江苏·镇江', cooperationYears: 2 },
    ],
  })

  await prisma.user.createMany({
    data: [
      { id: 'U_MANAGER', name: '张敏', role: 'PROCUREMENT_MANAGER', title: '采购经理', avatarColor: '#2563eb' },
      { id: 'U_ENGINEER', name: '林琪', role: 'PROCUREMENT_ENGINEER', title: '采购工程师·正极材料', avatarColor: '#0891b2' },
      { id: 'U_ENGINEER_2', name: '陈卓', role: 'PROCUREMENT_ENGINEER', title: '采购工程师·辅材', avatarColor: '#7c3aed' },
      { id: 'U_LEADER', name: '周启明', role: 'DEPARTMENT_LEADER', title: '供应链部门负责人', avatarColor: '#d97706' },
      { id: 'U_SUPPLIER', name: '王海', role: 'SUPPLIER', title: '供应商接口人·赣锋锂业', avatarColor: '#059669', supplierId: 'S001' },
    ],
  })

  const materials = [
    { id: 'M001', name: '电池级碳酸锂', type: '正极', supplierId: 'S001', demandMonthly: 4800, supplyMonthly: 3200, inventory: 1800, safetyStockMonths: 0.4, singleSource: true, dependenceLevel: '独家', riskLevel: 'RED', riskDescription: '单一来源占比 82%，库存仅可覆盖约 11 天，8 月存在明确供需缺口。', ownerId: 'U_ENGINEER' },
    { id: 'M002', name: '磷酸铁锂（LFP）', type: '正极', supplierId: 'S002', demandMonthly: 10000, supplyMonthly: 9500, inventory: 18000, safetyStockMonths: 1.8, singleSource: false, dependenceLevel: '主供', riskLevel: 'GREEN', riskDescription: '供应基本稳定，二供已通过小批量验证。', ownerId: 'U_ENGINEER' },
    { id: 'M003', name: '人造石墨', type: '负极', supplierId: 'S003', demandMonthly: 7200, supplyMonthly: 6100, inventory: 5000, safetyStockMonths: 0.7, singleSource: false, dependenceLevel: '主供', riskLevel: 'ORANGE', riskDescription: '库存覆盖不足 1 个月，石墨化产线检修导致交付承压。', ownerId: 'U_ENGINEER' },
    { id: 'M004', name: '储能型电解液', type: '电解液', supplierId: 'S004', demandMonthly: 4500, supplyMonthly: 4700, inventory: 12000, safetyStockMonths: 2.7, singleSource: false, dependenceLevel: '主供', riskLevel: 'GREEN', riskDescription: '供需平衡，长协覆盖率 92%。', ownerId: 'U_ENGINEER' },
    { id: 'M005', name: '湿法涂覆隔膜', type: '隔膜', supplierId: 'S005', demandMonthly: 3200, supplyMonthly: 2500, inventory: 2100, safetyStockMonths: 0.7, singleSource: false, dependenceLevel: '主供', riskLevel: 'ORANGE', riskDescription: '拉膜线调试延后，当前供应缺口 21.9%。', ownerId: 'U_ENGINEER' },
    { id: 'M006', name: 'PVDF 粘结剂', type: '辅材', supplierId: 'S006', demandMonthly: 850, supplyMonthly: 600, inventory: 500, safetyStockMonths: 0.6, singleSource: true, dependenceLevel: '独家', riskLevel: 'RED', riskDescription: '进口牌号单点依赖，库存不足 1 个月且替代验证尚未完成。', ownerId: 'U_ENGINEER_2' },
    { id: 'M007', name: 'CNT 导电剂', type: '辅材', supplierId: 'S007', demandMonthly: 600, supplyMonthly: 600, inventory: 2100, safetyStockMonths: 3.5, singleSource: true, dependenceLevel: '独家', riskLevel: 'ORANGE', riskDescription: '供需暂时平衡，但独家供应且安全库存低于 6 个月。', ownerId: 'U_ENGINEER_2' },
    { id: 'M008', name: '六氟磷酸锂', type: '电解液', supplierId: 'S004', demandMonthly: 1800, supplyMonthly: 1750, inventory: 2600, safetyStockMonths: 1.4, singleSource: false, dependenceLevel: '主供', riskLevel: 'YELLOW', riskDescription: '现货价格两周上涨 16%，已完成季度锁价，继续保持关注。', ownerId: 'U_ENGINEER' },
    { id: 'M009', name: '6μm 铜箔', type: '辅材', supplierId: 'S005', demandMonthly: 2600, supplyMonthly: 2800, inventory: 4200, safetyStockMonths: 1.6, singleSource: false, dependenceLevel: '主供', riskLevel: 'GREEN', riskDescription: '两家供应商均已批量供货。', ownerId: 'U_ENGINEER_2' },
    { id: 'M010', name: '勃姆石涂覆材料', type: '隔膜', supplierId: 'S002', demandMonthly: 900, supplyMonthly: 950, inventory: 1800, safetyStockMonths: 2, singleSource: false, dependenceLevel: '主供', riskLevel: 'GREEN', riskDescription: '国产化率提升，交付稳定。', ownerId: 'U_ENGINEER' },
  ]
  await prisma.material.createMany({ data: materials })

  const scoreSeries: Record<string, number[]> = {
    M001: [72, 68, 65, 59, 52, 45, 35, 22],
    M002: [78, 80, 82, 81, 84, 85, 86, 88],
    M003: [77, 74, 70, 66, 62, 59, 55, 51],
    M004: [82, 83, 82, 85, 87, 86, 88, 90],
    M005: [75, 72, 68, 66, 60, 58, 54, 48],
    M006: [63, 58, 54, 48, 42, 35, 29, 20],
    M007: [69, 67, 66, 64, 62, 62, 60, 58],
    M008: [80, 78, 76, 79, 82, 84, 85, 86],
    M009: [74, 77, 79, 82, 84, 85, 87, 89],
    M010: [79, 80, 81, 83, 84, 86, 87, 88],
  }
  const healthRows = Object.entries(scoreSeries).flatMap(([materialId, scores]) =>
    scores.map((score, index) => {
      const weekDate = dateFromNow(-(7 - index) * 7)
      return {
        materialId,
        score,
        weekDate,
        weekLabel: `${weekDate.getMonth() + 1}/${weekDate.getDate()}`,
      }
    }),
  )
  await prisma.healthSnapshot.createMany({ data: healthRows })

  await prisma.risk.createMany({
    data: [
      { id: 'R001', materialId: 'M001', type: 'SINGLE_SOURCE', level: 'RED', description: '电池级碳酸锂 82% 由单一渠道供应，安全库存低于 1 个月。', impactScope: '314Ah 储能电芯、长时储能系统项目', creatorId: 'U_ENGINEER', status: 'PENDING', isAuto: true, discoveredAt: dateFromNow(-5) },
      { id: 'R002', materialId: 'M003', type: 'LOW_INVENTORY', level: 'ORANGE', description: '石墨化产线检修，现货库存预计 21 天后耗尽。', impactScope: '280Ah、314Ah 储能电芯', creatorId: 'U_ENGINEER', status: 'IN_PROGRESS', isAuto: true, discoveredAt: dateFromNow(-11) },
      { id: 'R003', materialId: 'M005', type: 'LOW_INVENTORY', level: 'ORANGE', description: '关键拉膜线调试延期，8 月供应较需求少 700 吨。', impactScope: '314Ah 储能电芯二期排产', creatorId: 'U_ENGINEER', status: 'ASSESSING', isAuto: true, discoveredAt: dateFromNow(-3) },
      { id: 'R004', materialId: 'M006', type: 'POLICY', level: 'RED', description: '进口 PVDF 面临合规与运输不确定性，国产替代尚在 B 样验证。', impactScope: '全部 LFP 正极涂布产线', creatorId: 'U_ENGINEER_2', status: 'IN_PROGRESS', isAuto: true, discoveredAt: dateFromNow(-18) },
      { id: 'R005', materialId: 'M008', type: 'PRICE', level: 'YELLOW', description: 'LiPF6 现货价格两周上涨 16%，已启动季度锁价。', impactScope: '储能型电解液成本', creatorId: 'U_ENGINEER', status: 'CLOSED', isAuto: false, discoveredAt: dateFromNow(-35), closedAt: dateFromNow(-8) },
    ],
  })

  await prisma.action.createMany({
    data: [
      { id: 'A001', riskId: 'R002', type: 'STOCK', description: '协调华东仓紧急调拨 1,200 吨人造石墨，并将交付周期压缩至 10 天。', recommenderId: 'U_MANAGER', ownerId: 'U_ENGINEER', deadline: dateFromNow(4), priority: 'P0', status: 'IN_PROGRESS', completion: 55 },
      { id: 'A002', riskId: 'R004', type: 'SOURCING', description: '加速国产 PVDF 供应商 B 样验证，完成质量与产线适配评审。', recommenderId: 'U_MANAGER', ownerId: 'U_ENGINEER_2', deadline: dateFromNow(-8), priority: 'P0', status: 'IN_PROGRESS', completion: 25 },
      { id: 'A003', riskId: 'R005', type: 'PRICE_LOCK', description: '与核心供应商签订季度锁价补充协议，锁定 70% 需求量。', recommenderId: 'U_MANAGER', ownerId: 'U_ENGINEER', deadline: dateFromNow(-10), priority: 'P1', status: 'COMPLETED', completion: 100 },
    ],
  })

  await prisma.followTask.createMany({
    data: [
      { id: 'T001', actionId: 'A001', title: '完成人造石墨跨区调拨', ownerId: 'U_ENGINEER', collaboratorNames: '张敏、贝特瑞物流接口人', startDate: dateFromNow(-6), deadline: dateFromNow(4), progress: 55, status: 'IN_PROGRESS', progressDescription: '华东仓已完成出库评审，等待车辆排期。' },
      { id: 'T002', actionId: 'A002', title: '完成国产 PVDF B 样验证', ownerId: 'U_ENGINEER_2', collaboratorNames: '质量工程师、研发材料组', startDate: dateFromNow(-16), deadline: dateFromNow(-8), progress: 25, status: 'OVERDUE', progressDescription: '首批样品粘结强度通过，循环性能测试仍未完成。' },
      { id: 'T003', actionId: 'A003', title: '签署 LiPF6 季度锁价协议', ownerId: 'U_ENGINEER', collaboratorNames: '法务、财务 BP', startDate: dateFromNow(-28), deadline: dateFromNow(-10), progress: 100, status: 'COMPLETED', progressDescription: '补充协议已盖章生效。', closedAt: dateFromNow(-8) },
    ],
  })

  await prisma.taskUpdate.createMany({
    data: [
      { taskId: 'T001', progress: 25, description: '完成库存与可调拨量确认。', authorId: 'U_ENGINEER', createdAt: dateFromNow(-5) },
      { taskId: 'T001', progress: 55, description: '华东仓已锁定 1,200 吨库存，进入运输排期。', authorId: 'U_ENGINEER', createdAt: dateFromNow(-2) },
      { taskId: 'T002', progress: 25, description: 'B 样首轮物性测试完成，等待循环测试。', authorId: 'U_ENGINEER_2', createdAt: dateFromNow(-10) },
      { taskId: 'T003', progress: 100, description: '锁价协议完成双方盖章。', authorId: 'U_ENGINEER', createdAt: dateFromNow(-8) },
    ],
  })

  const plans = [
    { id: 'P001', materialId: 'M001', supplierId: 'S001', name: '锂盐二期 5 万吨扩产', startDate: dateFromNow(-180), endDate: dateFromNow(120), targetCapacity: 50000, investedCapex: 18600, totalCapex: 42000, fundingSources: '自有,贷款', stage: '安装', progress: 42, riskTypes: '设备,资金', riskDescription: '两套窑炉到货较计划晚 20 天，安装资源存在冲突。', ownerId: 'U_SUPPLIER', updatedAt: dateFromNow(-2) },
    { id: 'P002', materialId: 'M002', supplierId: 'S002', name: '储能级 LFP 四期产线', startDate: dateFromNow(-90), endDate: dateFromNow(180), targetCapacity: 80000, investedCapex: 12800, totalCapex: 36000, fundingSources: '自有,补贴', stage: '采购设备', progress: 38, riskTypes: '', riskDescription: '关键设备均已签约，按计划推进。', ownerId: 'U_ENGINEER', updatedAt: dateFromNow(-1) },
    { id: 'P003', materialId: 'M003', supplierId: 'S003', name: '石墨化一体化基地扩建', startDate: dateFromNow(-150), endDate: dateFromNow(60), targetCapacity: 60000, investedCapex: 29500, totalCapex: 46000, fundingSources: '自有,融资', stage: '调试', progress: 55, riskTypes: '设备,人员', riskDescription: '石墨化炉调试节拍低于预期，技术人员不足。', ownerId: 'U_ENGINEER', updatedAt: dateFromNow(-3) },
    { id: 'P004', materialId: 'M004', supplierId: 'S004', name: '华中电解液智能工厂', startDate: dateFromNow(-60), endDate: dateFromNow(300), targetCapacity: 120000, investedCapex: 7200, totalCapex: 52000, fundingSources: '自有,贷款,补贴', stage: '采购设备', progress: 22, riskTypes: '', riskDescription: '危化品资质扩容申请已受理。', ownerId: 'U_ENGINEER', updatedAt: dateFromNow(-1) },
    { id: 'P005', materialId: 'M005', supplierId: 'S005', name: '16μm 基膜产线扩建', startDate: dateFromNow(-250), endDate: dateFromNow(-10), targetCapacity: 95000, investedCapex: 51000, totalCapex: 58000, fundingSources: '自有,贷款', stage: '调试', progress: 68, riskTypes: '设备', riskDescription: '已超过计划结束日期，进口拉膜线仍未完成联调。', ownerId: 'U_ENGINEER', updatedAt: dateFromNow(-12) },
  ]

  for (const plan of plans) {
    const calculated = calculateExpansionRisk(plan)
    await prisma.expansionPlan.create({
      data: {
        ...plan,
        expectedProgress: calculated.expectedProgress,
        status: calculated.status,
      },
    })
  }

  await prisma.expansionItem.createMany({
    data: [
      { planId: 'P001', type: 'EQUIPMENT', name: '回转窑炉 3#', vendor: '苏州科工', orderNo: 'PO-2026-0182', expectedArrival: dateFromNow(-28), actualArrival: dateFromNow(-8), status: 'ARRIVED', delayDays: 20, note: '已进场，等待安装。' },
      { planId: 'P001', type: 'EQUIPMENT', name: '气流粉碎系统', vendor: '山东精工', orderNo: 'PO-2026-0201', expectedArrival: dateFromNow(18), status: 'SIGNED', delayDays: 0, note: '厂家周报显示按期。' },
      { planId: 'P001', type: 'MATERIAL', name: '工业级碳酸锂长协', vendor: '青海盐湖', orderNo: 'CT-2026-033', expectedArrival: dateFromNow(12), status: 'SIGNED', delayDays: 0, note: '首批 2,000 吨锁定。' },
      { planId: 'P002', type: 'EQUIPMENT', name: '砂磨机组', vendor: '常州自动化', orderNo: 'PO-2026-0315', expectedArrival: dateFromNow(46), status: 'SIGNED', delayDays: 0, note: '' },
      { planId: 'P003', type: 'EQUIPMENT', name: '石墨化炉 7-10#', vendor: '自研设备中心', orderNo: 'PO-2025-1198', expectedArrival: dateFromNow(-35), actualArrival: dateFromNow(-20), status: 'COMMISSIONING', delayDays: 15, note: '升温曲线仍在优化。' },
      { planId: 'P004', type: 'EQUIPMENT', name: '自动灌装线', vendor: '无锡智造', orderNo: 'PO-2026-0426', expectedArrival: dateFromNow(90), status: 'SIGNED', delayDays: 0, note: '' },
      { planId: 'P005', type: 'EQUIPMENT', name: '进口拉膜线', vendor: 'Brückner', orderNo: 'PO-2025-0088', expectedArrival: dateFromNow(-75), actualArrival: dateFromNow(-42), status: 'COMMISSIONING', delayDays: 33, note: '联调问题未关闭。' },
    ],
  })

  await prisma.notification.createMany({
    data: [
      { userId: 'U_MANAGER', type: 'RISK', level: 'RED', title: '电池级碳酸锂触发危险预警', message: '单点依赖且安全库存低于 1 个月，请尽快制定措施。', link: '/risks?risk=R001', createdAt: dateFromNow(-1) },
      { userId: 'U_MANAGER', type: 'TASK', level: 'RED', title: 'PVDF 替代验证任务逾期', message: '任务已逾期 8 天，当前进度 25%。', link: '/tasks?task=T002', createdAt: dateFromNow(-1) },
      { userId: 'U_MANAGER', type: 'EXPANSION', level: 'RED', title: '隔膜扩产计划严重延期', message: '16μm 基膜产线已超过结束日期，实际进度 68%。', link: '/expansion?plan=P005', createdAt: dateFromNow(-2) },
      { userId: 'U_ENGINEER', type: 'RISK', level: 'RED', title: '电池级碳酸锂需制定措施', message: '系统建议启动备货与备份供应商寻源。', link: '/risks?risk=R001', createdAt: dateFromNow(-1) },
      { userId: 'U_ENGINEER', type: 'TASK', level: 'YELLOW', title: '石墨调拨任务 4 天后到期', message: '当前进度 55%，请更新运输排期。', link: '/tasks?task=T001', createdAt: dateFromNow(-1) },
      { userId: 'U_ENGINEER_2', type: 'TASK', level: 'RED', title: '国产 PVDF B 样验证已逾期', message: '请更新循环性能测试结果或申请升级协调。', link: '/tasks?task=T002', createdAt: dateFromNow(-1) },
      { userId: 'U_LEADER', type: 'RISK', level: 'RED', title: '两项物料处于危险状态', message: '碳酸锂与 PVDF 需要管理层关注。', link: '/', createdAt: dateFromNow(-1) },
      { userId: 'U_SUPPLIER', type: 'EXPANSION', level: 'ORANGE', title: '扩产进度落后时间预期', message: '锂盐二期 5 万吨扩产实际进度落后，请提交本周更新。', link: '/expansion?plan=P001', createdAt: dateFromNow(-1) },
    ],
  })

  console.log('演示数据库初始化完成。')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
