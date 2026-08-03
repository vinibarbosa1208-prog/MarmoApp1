# Automação de Presença via WhatsApp

## Como funciona

1. Funcionário manda mensagem para o número da empresa: **"presença"**, "presente", "bom dia" ou "cheguei"
2. Evolution API recebe e dispara webhook para o n8n
3. n8n identifica o funcionário pelo número de telefone
4. MarmoApp registra a presença automaticamente no banco
5. Funcionário recebe confirmação com data e valor da diária

---

## Passo 1 — Variável de ambiente no Vercel

No painel do Vercel → seu projeto → Settings → Environment Variables, adicione:

```
WHATSAPP_WEBHOOK_SECRET = uma-chave-secreta-qualquer-ex-marm0app2026
```

Depois vá em **Deployments → Redeploy** para aplicar.

---

## Passo 2 — Cadastrar telefone dos funcionários

No sistema MarmoApp → **Funcionários** → editar cada funcionário → campo **Telefone**.

Cadastre no formato: `11999999999` (só números, com DDD, sem o 55 do Brasil).

> O sistema normaliza automaticamente — pode cadastrar com ou sem o 55.

---

## Passo 3 — Variáveis de ambiente no n8n

No n8n → Settings → Variables (ou nas credenciais do workflow), crie:

| Variável | Valor |
|---|---|
| `WHATSAPP_WEBHOOK_SECRET` | mesma chave do Vercel |
| `MARMORARIA_ID` | o UUID da sua marmoraria no Supabase |
| `EVOLUTION_API_URL` | ex: `http://seu-servidor:8080` |
| `EVOLUTION_API_KEY` | sua API key da Evolution |

### Como encontrar o MARMORARIA_ID

No Supabase → Table Editor → tabela `marmorarias` → copie o `id` da sua linha.

---

## Passo 4 — Importar o workflow no n8n

1. No n8n → **Workflows → Import from File**
2. Selecione o arquivo `n8n-presenca-whatsapp.json`
3. Ative o workflow (toggle no canto superior direito)
4. Copie a **Webhook URL** gerada (ex: `https://seu-n8n.com/webhook/evolution-presenca`)

---

## Passo 5 — Configurar webhook na Evolution API

Na Evolution API, configure o webhook da sua instância para apontar para a URL do n8n:

```bash
curl -X POST https://seu-evolution/webhook/set/NOME_DA_INSTANCIA \
  -H "apikey: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://seu-n8n.com/webhook/evolution-presenca",
    "webhook_by_events": false,
    "webhook_base64": false,
    "events": ["MESSAGES_UPSERT"]
  }'
```

---

## Teste

Peça para um funcionário cadastrado mandar **"presença"** para o número.

Deve receber:
```
✅ Olá, João! Presença registrada para hoje (25/07/2026).
💰 Diária: R$ 150,00

Bom trabalho! 💪
```

Se receber **"❌ Seu número não está cadastrado"**, o telefone não está cadastrado no funcionário ou está em formato diferente.

---

## Palavras aceitas para registrar presença

O funcionário pode mandar qualquer uma dessas:
- `presença`
- `presenca`  
- `presente`
- `bom dia`
- `cheguei`
- `aqui`

Outras mensagens são ignoradas (o bot não responde).
