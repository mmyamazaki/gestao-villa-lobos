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
import { apiUrl } from '../utils/apiBase'

export type AuthRole = 'admin' | 'teacher' | 'student'

/** Resultado do POST /api/auth/admin/login (o browser não distingue 401 vs 500 sem isto). */
export type AdminLoginResult = 'success' | 'invalid' | 'server' | 'network'

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

function clearAdminCookie() {
  void fetch(apiUrl('/api/auth/admin/logout'), { method: 'POST', credentials: 'include' }).catch(
    () => undefined,
  )
}

type AuthContextValue = {
  session: Session | null
  loginAdmin: (email: string, senha: string) => Promise<AdminLoginResult>
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

  /** Sincroniza sessão admin com cookie HttpOnly (valida LS obsoleto; recupera cookie sem LS). */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const stored = loadSession()
      if (stored?.role === 'admin') {
        const r = await fetch(apiUrl('/api/auth/admin/me'), { credentials: 'include' })
        if (cancelled) return
        let body: { ok?: boolean } = { ok: false }
        try {
          body = (await r.json()) as { ok?: boolean }
        } catch {
          /* ignore */
        }
        if (!body.ok) {
          setSession(null)
          saveSession(null)
        }
        return
      }
      if (!stored) {
        const r = await fetch(apiUrl('/api/auth/admin/me'), { credentials: 'include' })
        if (cancelled) return
        let body: { ok?: boolean } = { ok: false }
        try {
          body = (await r.json()) as { ok?: boolean }
        } catch {
          /* ignore */
        }
        if (body.ok) setSession({ role: 'admin' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loginAdmin = useCallback(async (email: string, senha: string): Promise<AdminLoginResult> => {
    let r: Response
    try {
      r = await fetch(apiUrl('/api/auth/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password: senha }),
      })
    } catch {
      return 'network'
    }
    if (r.status === 401 || r.status === 400) return 'invalid'
    if (!r.ok) return 'server'
    let body: { ok?: boolean }
    try {
      body = (await r.json()) as { ok?: boolean }
    } catch {
      return 'server'
    }
    if (!body.ok) return 'invalid'
    setSession({ role: 'admin' })
    return 'success'
  }, [])

  const loginTeacher = useCallback((login: string, senha: string, state: SchoolState) => {
    const u = login.trim().toLowerCase()
    const t = state.teachers.find(
      (x) => x.login.trim().toLowerCase() === u && x.senha === senha,
    )
    if (!t) return false
    clearAdminCookie()
    setSession({ role: 'teacher', teacherId: t.id })
    return true
  }, [])

  const loginStudent = useCallback((login: string, senha: string, state: SchoolState) => {
    const u = login.trim().toLowerCase()
    const s = state.students.find(
      (x) => x.login.trim().toLowerCase() === u && x.senha === senha,
    )
    if (!s) return false
    clearAdminCookie()
    setSession({ role: 'student', studentId: s.id })
    return true
  }, [])

  const logout = useCallback(() => {
    clearAdminCookie()
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
