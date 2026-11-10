// Mostra o texto do contrato (formato de lib/contrato/modelo.ts: "# ", "## ", "N. ").
export default function TextoContrato({ texto, claro = true }: { texto: string; claro?: boolean }) {
  const cor = claro ? 'text-[#2C2922]' : 'text-slate-200'
  const sub = claro ? 'text-[#6F6355]' : 'text-slate-400'
  return (
    <div className={`space-y-3 text-[15px] leading-relaxed ${cor}`}>
      {texto.split('\n').map((linha, i) => {
        if (linha.startsWith('# '))
          return (
            <h1 key={i} className="font-serif text-2xl font-bold leading-tight">
              {linha.slice(2)}
            </h1>
          )
        if (linha.startsWith('## '))
          return (
            <h2 key={i} className="pt-3 text-sm font-bold uppercase tracking-widest text-[#8A6D1F]">
              {linha.slice(3)}
            </h2>
          )
        const m = linha.match(/^(\d+)\. ([^.]+)\.(.*)$/)
        if (m)
          return (
            <p key={i}>
              <b>
                {m[1]}. {m[2]}.
              </b>
              {m[3]}
            </p>
          )
        if (i === 1) return <p key={i} className={`text-sm ${sub}`}>{linha}</p>
        return <p key={i}>{linha}</p>
      })}
    </div>
  )
}
