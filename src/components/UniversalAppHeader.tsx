import type { ReactNode } from 'react'

const CNPJ = '07.513.759/0001-17'

type Props = {
  subtitle?: string
  rightSlot?: ReactNode
}

export function UniversalAppHeader({ subtitle, rightSlot }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:px-4 md:gap-6 md:px-8 md:py-3">
        <div className="flex min-w-0 shrink-0 items-center md:w-[200px]">
          <img
            src="/logo-emvl-horizontal.png"
            alt="Escola de Música Villa-Lobos"
            className="h-8 w-auto max-w-[min(100%,220px)] object-contain object-left sm:h-9 md:h-11"
          />
        </div>

        <div className="hidden min-w-0 flex-1 text-center md:block">
          {subtitle && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#003366] md:text-[11px]">
              {subtitle}
            </p>
          )}
          <h1 className="text-sm font-bold text-slate-900 md:text-base">
            Escola de Música Villa-Lobos
          </h1>
          <p className="text-[11px] font-medium tabular-nums text-slate-600 md:text-xs">
            CNPJ: {CNPJ}
          </p>
        </div>

        {rightSlot && (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {rightSlot}
          </div>
        )}
      </div>
    </header>
  )
}
