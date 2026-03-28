import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { SchoolState } from '../domain/types'
import { getPrimaryAdminEmailLower, getPrimaryAdminPasswordFromEnv } from '../lib/adminEnv'
import { verifyAdminCredentials } from '../services/adminsSupabase'

export type AuthRole = 'admin' | 'teacher' | 'student'

type Session =
  | { role: 'admin' }
  | { role: 'teacher'; teacherId: string }
  | { role: 'student'; studentId: string }

const AUTH_KEY = 'emvl-auth-session-v2'

function loadSession(): Session | null {
  try {
    const s = localStorage.getItem(AUTH_KEY)
    if (!s) return null
    return JSON.parse(s) as Session
  } catch {
    return null
  }
}

function saveSession(s: Session | null) {
  if (!s) localStorage.removeItem(AUTH_KEY)
  else localStorage.setItem(AUTH_KEY, JSON.stringify(s))
}

type AuthContextValue = {
  session: Session | null
  loginAdmin: (email: string, senha: string) => Promise<boolean>
  loginTeacher: (login: string, senha: string, state: SchoolState) => boolean
  loginStudent: (login: string, senha: string, state: SchoolState) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession())

  useEffect(() => {
    saveSession(session)
  }, [session])

  const loginAdmin = useCallback(async (email: string, senha: string) => {
    const em = email.trim().toLowerCase()
    if (em === getPrimaryAdminEmailLower() && senha === getPrimaryAdminPasswordFromEnv()) {
      setSession({ role: 'admin' })
      return true
    }
    if (await verifyAdminCredentials(email, senha)) {
      setSession({ role: 'admin' })
      return true
    }
    return false
  }, [])

  const loginTeacher = useCallback((login: string, senha: string, state: SchoolState) => {
    const u = login.trim().toLowerCase()
    const t = state.teachers.find(
      (x) => x.login.trim().toLowerCase() === u && x.senha === senha,
    )
    if (!t) return false
    setSession({ role: 'teacher', teacherId: t.id })
    return true
  }, [])

  const loginStudent = useCallback((login: string, senha: string, state: SchoolState) => {
    const u = login.trim().toLowerCase()
    const s = state.students.find(
      (x) => x.login.trim().toLowerCase() === u && x.senha === senha,
    )
    if (!s) return false
    setSession({ role: 'student', studentId: s.id })
    return true
  }, [])

  const logout = useCallback(() => {
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      loginAdmin,
      loginTeacher,
      loginStudent,
      logout,
    }),
    [session, loginAdmin, loginTeacher, loginStudent, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth requires AuthProvider')
  return ctx
}

export function isAdmin(s: Session | null): s is { role: 'admin' } {
  return s?.role === 'admin'
}
export function isTeacher(s: Session | null): s is { role: 'teacher'; teacherId: string } {
  return s?.role === 'teacher'
}
export function isStudent(s: Session | null): s is { role: 'student'; studentId: string } {
  return s?.role === 'student'
}
