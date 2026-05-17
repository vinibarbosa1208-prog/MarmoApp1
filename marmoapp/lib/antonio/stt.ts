import OpenAI from 'openai'

let _client: OpenAI | null = null
function getClient(): OpenAI {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurada')
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _client
}

const MARBLE_HINT =
  'Orçamento de marmoraria, pedra, granito, mármore, quartzito, bancada, polimento, instalação, m², metro quadrado'

/** Transcreve um arquivo de áudio usando OpenAI Whisper */
export async function transcribeAudio(file: File | Blob, filename = 'audio.webm'): Promise<string> {
  const client = getClient()

  const audioFile = file instanceof File ? file : new File([file], filename, { type: file.type })

  const result = await client.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    language: 'pt',
    prompt: MARBLE_HINT,
  })

  return result.text
}
