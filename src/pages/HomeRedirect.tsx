import { Navigate } from 'react-router-dom'

export function HomeRedirect() {
  return <Navigate to="/board/expansion/view/overview" replace />
}