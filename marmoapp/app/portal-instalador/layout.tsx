// Portal do instalador — fase 5b (28/08): sem login, sem sessão. Decisão
// consciente do cliente (equipe pequena e de confiança) — não checa
// AuthContext nem nada parecido. Qualquer um com o link cai na tela de
// identificação por nome. Ver backlog "5b — mudança de decisão".
export default function PortalInstaladorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--light)' }}>
      <header style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', background: 'var(--dark)' }}>
        <img src="/logo-marmoapp.jpg" alt="MarmoApp" style={{ height: 26, objectFit: 'contain' }} />
      </header>
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>
        {children}
      </main>
    </div>
  )
}
