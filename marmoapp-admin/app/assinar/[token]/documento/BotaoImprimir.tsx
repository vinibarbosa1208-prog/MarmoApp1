'use client'

export default function BotaoImprimir() {
  return (
    <button onClick={() => window.print()} className="rounded-full bg-[#C9A84C] px-5 py-2 text-sm font-bold text-[#0D0D0D]">
      Salvar em PDF ou imprimir
    </button>
  )
}
