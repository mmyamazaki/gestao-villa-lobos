import { Navigate } from 'react-router-dom'
import { isAdmin, isStudent, isTeacher, useAuth } from '../auth/AuthContext'

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  if (!isAdmin(session)) {
    return <Navigate to="/login" replace state={{ tipo: 'secretaria' }} />
  }
  return <>{children}</>
}

export function RequireTeacher({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  if (!isTeacher(session)) {
    return <Navigate to="/login" replace state={{ tipo: 'professor' }} />
  }
  return <>{children}</>
}

export function RequireStudent({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  if (!isStudent(session)) {
    return <Navigate to="/login" replace state={{ tipo: 'aluno' }} />
  }
  return <>{children}</>
}
