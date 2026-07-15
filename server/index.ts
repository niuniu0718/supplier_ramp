import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import multer from 'multer'
import { ZodError } from 'zod'
import { currentUser } from './middleware/currentUser.js'
import { authRouter } from './routes/auth.js'
import { expansionRouter } from './routes/expansion.js'
import { notificationsRouter } from './routes/notifications.js'
import { risksRouter } from './routes/risks.js'
import { supplierPortalRouter } from './routes/supplierPortal.js'
import { tasksRouter } from './routes/tasks.js'
import { boardRouter } from './routes/boards.js'
import { startEscalationJob } from './jobs/escalationJob.js'

const app = express()
const port = Number(process.env.PORT ?? 3001)
const uploadsDirectory = fileURLToPath(new URL('../uploads/', import.meta.url))
const distDirectory = fileURLToPath(new URL('../dist/', import.meta.url))

app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(uploadsDirectory, { fallthrough: false, dotfiles: 'deny' }))
app.use('/api', currentUser)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'supplier-ramp-api-v2' })
})

app.use('/api', authRouter)
app.use('/api/boards', boardRouter)
app.use('/api/expansion-plans', expansionRouter)
app.use('/api/risks', risksRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/supplier', supplierPortalRouter)

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distDirectory))
  app.use((_req, res) => res.sendFile(`${distDirectory}/index.html`))
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({ message: '提交数据不完整或格式不正确。', issues: error.issues })
    return
  }
  if (error instanceof multer.MulterError) {
    res.status(400).json({ message: `上传失败：${error.message}` })
    return
  }
  if (error instanceof Error) {
    const status = (error as { status?: number }).status ?? 500
    console.error(error)
    res.status(status).json({ message: error.message || '服务器处理请求失败。' })
    return
  }
  res.status(500).json({ message: '服务器处理请求失败。' })
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`)
  })
  startEscalationJob()
}

export { app }