import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSchool } from '../state/SchoolContext'
import { daysLateFromPaymentDate, lateFees } from '../domain/finance'
import { FormActions } from '../components/FormActions'

export function Financeiro() {
  const { state } = useSchool()
  const navigate = useNavigate()
  const today = new Date().toISOString().slice(0, 10)
  const [paymentDate, setPaymentDate] = useState(today)

  const rows = useMemo(() => {
    return state.mensalidades.map((m) => {
      const ref = new Date(m.referenceMonth + '-01T12:00:00')
      const pay = new Date(paymentDate + 'T12:00:00')
      const late = daysLateFromPaymentDate(pay, ref)
      const fees = lateFees(m.liquidAmount, late)
      return { m, late, fees }
    })
  }, [state.mensalidades, paymentDate])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Financeiro</h2>
        <p className="mt-1 text-sm text-slate-600">
          Mensalidades geradas automaticamente ao <strong>salvar matrícula</strong> (valor do curso/estágio +
          desconto). Vencimento no dia <strong>01</strong>. Multa <strong>2%</strong> e juros{' '}
          <strong>0,3% ao dia</strong> sobre o valor líquido após o vencimento. Ajuste a data abaixo para simular
          o total.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-slate-700">
          Data de pagamento (simulação de multa/juros)
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
          />
        </label>
      </section>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[960px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Aluno</th>
              <th className="px-3 py-3">Curso</th>
              <th className="px-3 py-3">Mês ref.</th>
              <th className="px-3 py-3 text-right">Base</th>
              <th className="px-3 py-3 text-right">Desc.</th>
              <th className="px-3 py-3 text-right">Líquido</th>
              <th className="px-3 py-3 text-right">Dias atraso</th>
              <th className="px-3 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  Nenhuma mensalidade registrada. Conclua uma <strong>matrícula</strong> em Alunos para gerar a
                  primeira cobrança.
                </td>
              </tr>
            )}
            {rows.map(({ m, late, fees }) => (
              <tr key={m.id} className="hover:bg-slate-50/80">
                <td className="px-3 py-3 font-medium text-slate-900">
                  {m.studentNome}
                  <div className="text-xs font-normal text-slate-500">Gerada na matrícula</div>
                </td>
                <td className="px-3 py-3 text-slate-600">{m.courseLabel}</td>
                <td className="px-3 py-3 tabular-nums text-slate-600">{m.referenceMonth}</td>
                <td className="px-3 py-3 text-right tabular-nums">R$ {m.baseAmount.toFixed(2)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{m.discountPercent}%</td>
                <td className="px-3 py-3 text-right tabular-nums">R$ {m.liquidAmount.toFixed(2)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{late}</td>
                <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-900">
                  R$ {fees.total.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormActions
        saveLabel="Salvar"
        cancelLabel="Cancelar"
        onCancel={() => {
          setPaymentDate(new Date().toISOString().slice(0, 10))
          navigate('/financeiro', { replace: true })
        }}
        onSave={() => navigate('/financeiro', { replace: true })}
      />
    </div>
  )
}
