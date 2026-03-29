import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useSchool } from '../state/SchoolContext'

const field =
  'w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#00AEEF] focus:ring-2 focus:ring-[#00AEEF]/25'

type Tipo = 'secretaria' | 'professor' | 'aluno'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loginAdmin, loginTeacher, loginStudent } = useAuth()
  const { state } = useSchool()

  const [tipo, setTipo] = useState<Tipo>('secretaria')
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [busyAdmin, setBusyAdmin] = useState(false)

  useEffect(() => {
    const t = (location.state as { tipo?: Tipo } | null)?.tipo
    if (t === 'professor' || t === 'aluno' || t === 'secretaria') setTipo(t)
  }, [location.state])

  useEffect(() => {
    if (session?.role === 'admin') navigate('/', { replace: true })
    else if (session?.role === 'teacher') navigate('/professor', { replace: true })
    else if (session?.role === 'student') navigate('/aluno', { replace: true })
  }, [session, navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border-2 border-slate-200 bg-white p-8 shadow-xl">
        <div className="flex flex-col items-center">
          <img
            src="/logo-emvl-horizontal.png"
            alt="Escola de Música Villa-Lobos"
            className="h-auto w-full max-w-[320px] object-contain"
          />
          <p className="mt-3 text-center text-xs font-medium tabular-nums text-slate-600">
            CNPJ: 07.513.759/0001-17
          </p>
          <p className="mt-2 text-center text-sm text-slate-500">Escolha o tipo de acesso</p>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {(['secretaria', 'professor', 'aluno'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={[
                'rounded-lg py-2 text-xs font-semibold sm:text-sm',
                tipo === t
                  ? 'bg-[#003366] text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
              ].join(' ')}
              onClick={() => {
                setTipo(t)
                setErro('')
              }}
            >
              {t === 'secretaria' ? 'Secretaria' : t === 'professor' ? 'Professor' : 'Aluno'}
            </button>
          ))}
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setErro('')
            void (async () => {
              if (tipo === 'secretaria') {
                setBusyAdmin(true)
                try {
                  const ok = await loginAdmin(usuario.trim(), senha)
                  if (!ok) setErro('E-mail ou senha da secretaria inválidos.')
                } finally {
                  setBusyAdmin(false)
                }
                return
              }
              if (tipo === 'professor') {
                const ok = loginTeacher(usuario.trim(), senha, state)
                if (!ok) setErro('Login ou senha do professor inválidos.')
                return
              }
              const ok = loginStudent(usuario.trim(), senha, state)
              if (!ok) setErro('Login ou senha do aluno inválidos.')
            })()
          }}
        >
          <label className="block">
            <span className="text-sm font-semibold text-[#003366]">
              {tipo === 'secretaria' ? 'E-mail' : 'Login'}
            </span>
            <input
              type={tipo === 'secretaria' ? 'email' : 'text'}
              autoComplete="username"
              className={`${field} mt-1.5`}
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder={
                tipo === 'secretaria'
                  ? import.meta.env.VITE_ADMIN_EMAIL || 'seu e-mail da secretaria'
                  : 'seu login'
              }
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#003366]">Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              className={`${field} mt-1.5`}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </label>
          {erro && <p className="text-sm text-red-700">{erro}</p>}
          <button
            type="submit"
            disabled={busyAdmin}
            className="w-full rounded-lg bg-[#003366] py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#00264d] focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAdmin ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
