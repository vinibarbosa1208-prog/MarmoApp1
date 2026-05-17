import Anthropic from '@anthropic-ai/sdk'
import { buildKnowledgeBase, type Catalogo } from './knowledge-base'
import { parseOrcamento, stripOrcamento, type OrcParsed } from './parser'

const SYSTEM_BASE = `Você é o Agente Antônio, assistente especializado em orçamentos para marmorarias brasileiras.

Seu papel:
- Interpretar descrições em linguagem natural de serviços com pedra/mármore/granito
- Extrair itens do orçamento (materiais, serviços, dimensões, quantidades, preços)
- Calcular áreas automaticamente quando dimensões forem fornecidas (largura × comprimento = m²)
- Gerar orçamentos estruturados prontos para salvar
- Sugerir materiais e serviços do catálogo da marmoraria

Regras de negócio:
- Materiais: granito, mármore, quartzito, porcelanato, etc. — cobrados em m²
- Serviços comuns: corte, polimento, instalação, acabamento, furo, rejuntamento
- Sempre perguntar dimensões quando não fornecidas para materiais em m²
- Calcular subtotal dos itens + mão de obra separadamente
- Manter tom profissional e prestativo em português brasileiro

Quando tiver informações suficientes para gerar o orçamento completo, finalize com um bloco JSON no seguinte formato EXATO (sempre ao final da resposta, precedido de "---ORCAMENTO---"):

---ORCAMENTO---
{
  "descricao": "Título do orçamento",
  "cliente_nome": "Nome do cliente ou null",
  "itens": [
    { "tipo": "material", "descricao": "Nome do material", "quantidade": 2.4, "preco_unitario": 350.00 },
    { "tipo": "servico", "descricao": "Nome do serviço", "quantidade": 1, "preco_unitario": 200.00 }
  ],
  "mao_obra": 0,
  "observacoes": "Observações relevantes"
}

Tipos válidos: "material", "servico", "frete", "outro".
Sempre use quantidade e preco_unitario numéricos.`

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentResult {
  displayText: string
  orcamento: OrcParsed | null
  rawText: string
  inputTokens: number
  outputTokens: number
}

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não configurada')
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _client
}

export async function runAgent(
  messages: AgentMessage[],
  catalogo: Catalogo,
): Promise<AgentResult> {
  const client = getClient()
  const systemPrompt = `${SYSTEM_BASE}\n\n${buildKnowledgeBase(catalogo)}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
  const orcamento = parseOrcamento(rawText)
  const displayText = stripOrcamento(rawText)

  return {
    displayText,
    orcamento,
    rawText,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}
