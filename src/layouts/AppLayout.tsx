import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { UniversalAppHeader } from '../components/UniversalAppHeader'

const nav: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Início', end: true },
  { to: '/alunos', label: 'Alunos' },
  { to: '/cursos', label: 'Cursos' },
  { to: '/professores', label: 'Professores' },
  { to: '/financeiro', label: 'Financeiro' },
  { to: '/calendario', label: 'Calendário' },
  { to: '/configuracoes', label: 'Configurações' },
]

function linkClass({ isActive }: { isActive: boolean }) {
  return [
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-[#003366] text-white'
      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ')
}

export function AppLayout() {
  const [open, setOpen] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
      <UniversalAppHeader
        subtitle="Porto Velho — RO · Secretaria"
        rightSlot={
          <>
            <button
              type="button"
              onClick={() => {
                logout()
                navigate('/login', { replace: true, state: { tipo: 'secretaria' } })
              }}
              className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            >
              Sair
            </button>
            <button
              type="button"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-800 shadow-sm md:hidden"
              aria-expanded={open}
              aria-label="Menu"
              onClick={() => setOpen((v) => !v)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </>
        }
      />

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 py-2 lg:flex xl:gap-2">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={Boolean(item.end)}
                className={linkClass}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          {open && (
            <div className="border-t border-slate-100 pb-4 lg:hidden">
              <div className="mx-auto flex max-w-7xl flex-col gap-1 pt-2">
                {nav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={Boolean(item.end)}
                    className={({ isActive }) => `${linkClass({ isActive })} min-h-[44px]`}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
