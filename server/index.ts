import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import { ZodError } from 'zod'
import { authRouter } from './routes/auth.js'
import { dashboardRouter } from './routes/dashboard.js'
import { expansionRouter } from './routes/expansion.js'
import { materialsRouter } from './routes/materials.js'
import { notificationsRouter } from './routes/notifications.js'
import { risksRouter } from './routes/risks.js'
import { tasksRouter } from './routes/tasks.js'
import { currentUser } from './middleware/currentUser.js'

const app = express()
const port = Number(process.env.PORT ?? 3001)
const uploadsDirectory = fileURLToPath(new URL('../uploads/', import.meta.url))
const distDirectory = fileURLToPath(new URL('../dist/', import.meta.url))

app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use('/uploads', express.static(uploadsDirectory, { fallthrough: false, dotfiles: 'deny' }))
app.use('/api', currentUser)
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'supplier-ramp-api' }))
app.use('/api', authRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/materials', materialsRouter)
app.use('/api/risks', risksRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/expansion-plans', expansionRouter)
app.use('/api/notifications', notificationsRouter)

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distDirectory))
  app.use((_req, res) => res.sendFile(`${distDirectory}/index.html`))
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({ message: '提交数据不完整或格式不正确。', issues: error.issues })
    return
  }
  if (error instanceof Error) {
    console.error(error)
    res.status(500).json({ message: error.message || '服务器处理请求失败。' })
    return
  }
  res.status(500).json({ message: '服务器处理请求失败。' })
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`)
  })
}

export { app }
