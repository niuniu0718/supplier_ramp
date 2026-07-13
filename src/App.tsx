import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { LoadingState } from './components/ui/States'
import { useAuth } from './context/AuthContext'

const SupplyDashboard = lazy(() => import('./pages/SupplyDashboard').then((module) => ({ default: module.SupplyDashboard })))
const RiskActions = lazy(() => import('./pages/RiskActions').then((module) => ({ default: module.RiskActions })))
const TaskTracking = lazy(() => import('./pages/TaskTracking').then((module) => ({ default: module.TaskTracking })))
const ExpansionTracking = lazy(() => import('./pages/ExpansionTracking').then((module) => ({ default: module.ExpansionTracking })))

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading"><LoadingState label="正在准备演示环境" /></div>

  return (
    <AppLayout>
      <Suspense fallback={<LoadingState label="正在加载工作台" />}>
        <Routes>
          <Route path="/" element={<SupplyDashboard />} />
          <Route path="/risks" element={<RiskActions />} />
          <Route path="/tasks" element={<TaskTracking />} />
          <Route path="/expansion" element={<ExpansionTracking />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  )
}