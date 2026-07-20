# MarmoApp — Contexto Completo para Agentes

## Regras obrigatórias

### Antes de qualquer commit e push:
1. Rode `npx tsc --noEmit 2>&1 | grep -v node_modules` — só erros nos nossos arquivos
2. Os arquivos abaixo têm erros **pré-existentes** — ignorar, não quebram o build Vercel:
   - `app/(app)/layout.tsx`
   - `app/(app)/orcamentos/[id]/editar/page.tsx`
   - `app/(app)/orcamentos/novo/page.tsx`
   - `app/login/page.tsx`
   - `app/onboarding/page.tsx`
3. Se git retornar `index.lock: File exists` → fechar Cursor/VS Code e deletar `.git/index.lock`
4. NUNCA fazer push de arquivos com null bytes (`\x00`) — limpar com Python se necessário

### Padrão de auth:
- Componentes `'use client'` → importar `supabase` de `@/lib/supabase` (createBrowserClient)
- Server components / route handlers → `createServerClient` com cookies
- Para buscar marmoraria_id: `supabase.auth.getUser()` + `from('usuarios')`
- Sempre envolver saves em `try/catch/finally` com `setLoading(false)` no finally

### Padrão de insert:
- Sempre incluir `marmoraria_id` nos inserts
- Nunca assumir que o contexto já tem `marmoraria_id` disponível

---

## O que é este projeto
SaaS de gestão para marmorarias. Stack: Next.js 16 App Router + Supabase + Vercel.
- **Landing page**: `marmoapp.com` → arquivo estático `../index.html`
- **App**: `app.marmoapp.com` → este repositório Next.js
- **Supabase project ID**: `pptkgbhmnvhsrffqyfmn`
- **Deploy**: push para `main` → Vercel deploya automaticamente em ~2 min

---

## Banco de dados (Supabase)

### Tabelas principais
```
auth.users          — gerenciado pelo Supabase Auth
public.marmorarias  — owner_id, nome, cnpj, telefone, cidade, email, plano, trial_expira, setup_concluido
public.usuarios     — id (= auth.uid), marmoraria_id, nome, email, perfil, ativo
public.orcamentos   — marmoraria_id, cliente_id, ...
public.clientes     — marmoraria_id, ...
public.agenda       — marmoraria_id, titulo, data_hora, ...
public.estoque      — marmoraria_id, ...
public.leads        — email, whatsapp, nome_marmoraria, utm_source, utm_medium, utm_campaign
```

### RLS — regra fundamental
**TODAS as policies** checam `public.usuarios WHERE id = auth.uid()` para obter `marmoraria_id`.
Se o usuário não tiver registro em `public.usuarios` → não vê NADA no sistema.

### Trigger crítico (aplicado em produção)
`trg_create_owner_usuario` → `AFTER INSERT ON public.marmorarias FOR EACH ROW WHEN (NEW.owner_id IS NOT NULL)`
Cria automaticamente o registro em `public.usuarios` com `perfil = 'admin'`.

⚠️ `usuarios.perfil` aceita APENAS: `'admin'`, `'gerente'`, `'operador'`

### Função auxiliar
```sql
-- SECURITY DEFINER, STABLE
public.get_marmoraria_id() → uuid
```

---

## Fluxo de cadastro (atual — pós refatoração)

```
marmoapp.com → modal cadastro → supabase.auth.signUp()
                              → marmorarias.insert()
                              → trigger cria usuarios
                              → redirect app.marmoapp.com/dashboard

app.marmoapp.com/          → redirect /cadastro
app.marmoapp.com/register  → redirect /cadastro
app.marmoapp.com/comecar   → redirect /cadastro
app.marmoapp.com/cadastro  → formulário único (marmoraria, email, WhatsApp, cidade, CNPJ opt, senha)
                           → auth.signUp → garantir sessão → /api/leads (best-effort)
                           → marmorarias.insert → trigger cria usuarios → /dashboard
```

---

## Arquivos novos/alterados recentemente (aguardando push)

| Arquivo | Mudança |
|---------|---------|
| `app/page.tsx` | `redirect('/cadastro')` |
| `app/register/page.tsx` | `redirect('/cadastro')` |
| `app/comecar/page.tsx` | `redirect('/cadastro')` |
| `app/cadastro/page.tsx` | **NOVO** — formulário completo de cadastro |
| `app/api/leads/route.ts` | Redirect atualizado para `/cadastro` |

---

## Tarefas pendentes (ao abrir este projeto)

### 🔴 Fazer push (bloqueado por git index.lock)
```bash
# 1. Fechar Cursor/VS Code
# 2. Deletar o lock:
del .git\index.lock           # PowerShell/CMD
# rm .git/index.lock          # Git Bash

# 3. Commitar e fazer push:
git add app/page.tsx app/register/page.tsx app/comecar/page.tsx app/cadastro/page.tsx app/api/leads/route.ts
git commit -m "feat: nova pagina /cadastro com fluxo unico de cadastro"
git push origin main
```

### 🟡 Verificar após deploy
1. `app.marmoapp.com/` redireciona para `/cadastro` ✓
2. Fluxo completo: preencher formulário → account criada → marmoraria criada → usuarios criado pelo trigger → dashboard abre
3. No Supabase > Authentication > Settings: confirmar que **"Enable email confirmations" = OFF**

### 🟢 Melhorias futuras
- Vídeo real na landing page (placeholder com `alert('Em breve!')`)
- Pixel Meta no `/cadastro` para tracking de conversão
- Corrigir erros TS pré-existentes em `login/page.tsx` e `onboarding/page.tsx`

---

## Contexto de negócio

- **Produto**: SaaS para gestão de marmorarias (orçamentos, agenda, estoque, clientes, projetos)
- **Plano**: `basic` (trial 7 dias)
- **Público**: donos de marmorarias no Brasil
- **Tom**: profissional, confiável — paleta dourado (#C9A84C) + escuro (#0D0D0D) + branco
- **Meta Ads**: campanhas ativas — cada cadastro com erro = dinheiro desperdiçado

---

## Comandos úteis

```bash
# TypeScript — só nossos arquivos
npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v "orcamentos\|layout\|login\|onboarding"

# Checar null bytes em arquivos escritos
python3 -c "
import glob
for f in glob.glob('app/**/*.tsx', recursive=True) + glob.glob('app/**/*.ts', recursive=True):
    b = open(f,'rb').read()
    if b'\x00' in b:
        print('NULL BYTES:', f)
        open(f,'wb').write(b.rstrip(b'\x00'))
        print('  -> corrigido')
"

# Dev local
npm run dev
```
