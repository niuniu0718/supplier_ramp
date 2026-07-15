import { Router } from 'express'
import { getExpansionOverview } from '../services/boardViews/expansion/overview.js'
import { getExpansionTimeline } from '../services/boardViews/expansion/timeline.js'
import { getExpansionBenchmark } from '../services/boardViews/expansion/benchmark.js'
import { getExpansionEvidence } from '../services/boardViews/expansion/evidence.js'
import { getRisksOverview } from '../services/boardViews/risks/overview.js'
import { getRisksByType } from '../services/boardViews/risks/byType.js'
import { getRisksEscalation } from '../services/boardViews/risks/escalation.js'
import { getRisksClosure } from '../services/boardViews/risks/closure.js'
import { getTasksMyTodo } from '../services/boardViews/tasks/myTodo.js'
import { getTasksOverdue } from '../services/boardViews/tasks/overdue.js'
import { getTasksEscalation } from '../services/boardViews/tasks/escalation.js'
import { getTasksClosure } from '../services/boardViews/tasks/closure.js'

export const boardRouter = Router()

const handlers: Record<string, Record<string, (userId?: string) => Promise<unknown>>> = {
  expansion: {
    overview: () => getExpansionOverview(),
    timeline: () => getExpansionTimeline(),
    benchmark: () => getExpansionBenchmark(),
    evidence: () => getExpansionEvidence(),
  },
  risks: {
    overview: () => getRisksOverview(),
    'by-type': () => getRisksByType(),
    escalation: () => getRisksEscalation(),
    closure: () => getRisksClosure(),
  },
  tasks: {
    'my-todo': (userId) => getTasksMyTodo(userId),
    overdue: () => getTasksOverdue(),
    escalation: () => getTasksEscalation(),
    closure: () => getTasksClosure(),
  },
}

boardRouter.get('/:board/views/:view', async (req, res, next) => {
  try {
    const board = req.params.board
    const view = req.params.view
    const handler = handlers[board]?.[view]
    if (!handler) {
      res.status(404).json({ message: `未知视图 ${board}/${view}` })
      return
    }
    const userId = req.currentUser?.id
    const data = await handler(userId)
    res.json(data)
  } catch (error) {
    next(error)
  }
})