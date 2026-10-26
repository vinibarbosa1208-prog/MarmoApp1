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
    // Link de indicação de outro cliente: /minha-pia?ref=<nº do plano>
    const ref = sp.get('ref')
    if (ref && /^\d{1,8}$/.test(ref)) { achados.utm_source = 'indicacao'; achados.utm_medium = 'cliente'; achados.utm_content = 'plano-' + ref }
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

// Botão fixo de WhatsApp, com a mensagem já escrita conforme a tela.
export function WhatsFlutuante({ numero, mensagem, acimaDaBarra = false }: { numero: string | null | undefined; mensagem: string; acimaDaBarra?: boolean }) {
  const href = linkWhatsapp(numero, mensagem)
  if (!href) return null
  return (
    <a className={`mp-whats${acimaDaBarra ? ' acima' : ''}`} href={href} target="_blank" rel="noopener noreferrer" aria-label="Conversar no WhatsApp">
      <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.2-.2-.5-.3Z"/>
      </svg>
      <span>Dúvidas?</span>
    </a>
  )
}
