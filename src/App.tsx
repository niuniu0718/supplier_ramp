import { Suspense, lazy, type ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { HomeRedirect } from './pages/HomeRedirect'
import { Login } from './pages/Login'
import { useAuth } from './context/AuthContext'
import { LoadingState } from './components/ui/States'

const ExpansionOverview = lazy(() => import('./pages/expansion/Overview').then((m) => ({ default: m.ExpansionOverview })))
const ExpansionTimeline = lazy(() => import('./pages/expansion/Timeline').then((m) => ({ default: m.ExpansionTimeline })))
const ExpansionEvidence = lazy(() => import('./pages/expansion/Evidence').then((m) => ({ default: m.ExpansionEvidence })))

const RisksOverview = lazy(() => import('./pages/risks/Overview').then((m) => ({ default: m.RisksOverview })))
const RisksByType = lazy(() => import('./pages/risks/ByType').then((m) => ({ default: m.RisksByType })))
const RisksEscalation = lazy(() => import('./pages/risks/Escalation').then((m) => ({ default: m.RisksEscalation })))
const RisksClosure = lazy(() => import('./pages/risks/Closure').then((m) => ({ default: m.RisksClosure })))

const TasksMyTodo = lazy(() => import('./pages/tasks/MyTodo').then((m) => ({ default: m.TasksMyTodo })))
const TasksOverdue = lazy(() => import('./pages/tasks/Overdue').then((m) => ({ default: m.TasksOverdue })))
const TasksEscalation = lazy(() => import('./pages/tasks/Escalation').then((m) => ({ default: m.TasksEscalation })))
const TasksClosure = lazy(() => import('./pages/tasks/Closure').then((m) => ({ default: m.TasksClosure })))

function RequireAuth({ children }: { children: ReactNode }) {
  const { username, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingState label="验证身份…" />
  if (!username) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<HomeRedirect />} />
        <Route path="/board/expansion/view/overview" element={<Suspense fallback={<LoadingState />}><ExpansionOverview /></Suspense>} />
        <Route path="/board/expansion/view/timeline" element={<Suspense fallback={<LoadingState />}><ExpansionTimeline /></Suspense>} />
        <Route path="/board/expansion/view/evidence" element={<Suspense fallback={<LoadingState />}><ExpansionEvidence /></Suspense>} />
        <Route path="/board/risks/view/overview" element={<Suspense fallback={<LoadingState />}><RisksOverview /></Suspense>} />
        <Route path="/board/risks/view/by-type" element={<Suspense fallback={<LoadingState />}><RisksByType /></Suspense>} />
        <Route path="/board/risks/view/escalation" element={<Suspense fallback={<LoadingState />}><RisksEscalation /></Suspense>} />
        <Route path="/board/risks/view/closure" element={<Suspense fallback={<LoadingState />}><RisksClosure /></Suspense>} />
        <Route path="/board/tasks/view/my-todo" element={<Suspense fallback={<LoadingState />}><TasksMyTodo /></Suspense>} />
        <Route path="/board/tasks/view/overdue" element={<Suspense fallback={<LoadingState />}><TasksOverdue /></Suspense>} />
        <Route path="/board/tasks/view/escalation" element={<Suspense fallback={<LoadingState />}><TasksEscalation /></Suspense>} />
        <Route path="/board/tasks/view/closure" element={<Suspense fallback={<LoadingState />}><TasksClosure /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App