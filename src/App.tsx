import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { Alunos } from './pages/Alunos'
import { Calendario } from './pages/Calendario'
import { Configuracoes } from './pages/Configuracoes'
import { Cursos } from './pages/Cursos'
import { Dashboard } from './pages/Dashboard'
import { Financeiro } from './pages/Financeiro'
import { Login } from './pages/Login'
import { Matricula } from './pages/Matricula'
import { ProfessorForm } from './pages/ProfessorForm'
import { Professores } from './pages/Professores'

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="alunos" element={<Alunos />} />
        <Route path="alunos/novo" element={<Matricula />} />
        <Route path="alunos/:id" element={<Matricula />} />
        <Route path="cursos" element={<Cursos />} />
        <Route path="professores" element={<Professores />} />
        <Route path="professores/novo" element={<ProfessorForm />} />
        <Route path="professores/:id" element={<ProfessorForm />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="calendario" element={<Calendario />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
