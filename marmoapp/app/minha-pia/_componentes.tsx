'use client'

import Link from 'next/link'

// Bancada vista de cima. `progresso` 0–100 preenche com a pedra escolhida;
// o restante aparece só como contorno (o que ainda falta pagar).
export function Bancada({ codigo, progresso = 100, rotulo }: { codigo: string; progresso?: number; rotulo?: string }) {
  const p = Math.max(0, Math.min(100, progresso))
  const cubaCoberta = p >= 80
  return (
    <div className="bancada bancada-sombra" role="img" aria-label={rotulo ?? `Pia de ${codigo}, ${p}% paga`}>
      <div className="bancada-contorno" />
      <div className={`bancada-preenchida pedra-${codigo}${p >= 100 ? ' cheia' : ''}`} style={{ width: `${p}%` }}>
        <div className="bancada-frontao" />
      </div>
      <div className={`bancada-cuba${cubaCoberta ? '' : ' vazia'}`} />
    </div>
  )
}

export function Topo({ direita }: { direita?: React.ReactNode }) {
  return (
    <header className="mp-topo">
      <Link href="/minha-pia" className="mp-marca">
        Pia Programada
        <small>por Real Pedras Marmoraria, Arujá–SP</small>
      </Link>
      {direita}
    </header>
  )
}

// UTM do anúncio: guarda na primeira visita e manda junto na adesão.
const CHAVE_UTM = 'mp_utm'
export function guardarUtm() {
  try {
    const sp = new URLSearchParams(window.location.search)
    const campos = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid']
    const achados: Record<string, string> = {}
    campos.forEach(c => { const v = sp.get(c); if (v) achados[c] = v })
    if (Object.keys(achados).length) sessionStorage.setItem(CHAVE_UTM, JSON.stringify(achados))
  } catch { /* navegador sem storage */ }
}
export function lerUtm(): Record<string, string> {
  try { return JSON.parse(sessionStorage.getItem(CHAVE_UTM) || '{}') } catch { return {} }
}

export function linkWhatsapp(numero: string | null | undefined, texto: string): string | null {
  const d = (numero || '').replace(/\D/g, '')
  if (d.length < 10) return null
  const intl = d.startsWith('55') ? d : '55' + d
  return `https://wa.me/${intl}?text=${encodeURIComponent(texto)}`
}
