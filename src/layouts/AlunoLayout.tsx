import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { UniversalAppHeader } from '../components/UniversalAppHeader'

export function AlunoLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <UniversalAppHeader
        subtitle="Portal do aluno"
        rightSlot={
          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/login', { replace: true, state: { tipo: 'aluno' } })
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Sair
          </button>
        }
      />
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
