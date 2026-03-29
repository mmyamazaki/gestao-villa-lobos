/** Legenda compacta — mesmas cores da grade (`ScheduleGrid`) */
export function SchedulePortalLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-6 rounded bg-emerald-300 ring-1 ring-emerald-500" />
        Livre (na grade)
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-6 rounded bg-red-500 ring-1 ring-red-600" />
        Indisponível
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-6 rounded bg-indigo-300 ring-1 ring-indigo-500" />
        Aula regular
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-6 rounded bg-violet-300 ring-1 ring-violet-500" />
        Reposição
      </span>
    </div>
  )
}
