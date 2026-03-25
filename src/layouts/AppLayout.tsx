import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 lg:gap-6 lg:px-8">
          <div className="flex min-w-0 shrink-0 items-center">
            <img
              src="/logo-emvl-horizontal.png"
              alt="Escola de Música Villa-Lobos de Porto Velho"
              className="h-9 w-auto max-w-[min(100%,220px)] object-contain object-left sm:h-10 md:h-11 md:max-w-[260px]"
            />
          </div>

          <div className="hidden min-w-0 flex-1 text-center sm:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#003366]">
              Porto Velho — RO
            </p>
            <h1 className="truncate text-sm font-bold text-slate-900 md:text-base">
              Escola de Música Villa-Lobos
            </h1>
          </div>

          <nav className="hidden min-w-0 flex-1 items-center justify-end gap-1 lg:flex xl:gap-2">
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

          <div className="flex shrink-0 lg:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-800 shadow-sm"
              aria-expanded={open}
              aria-label="Menu"
              onClick={() => setOpen((v) => !v)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-slate-100 bg-white px-4 pb-4 lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1 pt-2">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={Boolean(item.end)}
                  className={linkClass}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
