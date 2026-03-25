import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const field =
  'w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#00AEEF] focus:ring-2 focus:ring-[#00AEEF]/25'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border-2 border-slate-200 bg-white p-8 shadow-xl">
        <div className="flex flex-col items-center">
          <img
            src="/logo-emvl-horizontal.png"
            alt="Escola de Música Villa-Lobos de Porto Velho"
            className="h-auto w-full max-w-[320px] object-contain"
          />
          <p className="mt-4 text-center text-sm text-slate-500">Acesso ao painel administrativo</p>
        </div>

        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            navigate('/', { replace: true })
          }}
        >
          <label className="block">
            <span className="text-sm font-semibold text-[#003366]">E-mail</span>
            <input
              type="email"
              autoComplete="username"
              className={`${field} mt-1.5`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#003366]">Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              className={`${field} mt-1.5`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-[#003366] py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#00264d] focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50"
          >
            Entrar
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Demonstração local — sem validação de credenciais.{' '}
          <Link to="/" className="font-medium text-[#003366] underline hover:text-[#00AEEF]">
            Voltar ao início
          </Link>
        </p>
      </div>
    </div>
  )
}
