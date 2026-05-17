export async function GET() {
  const checks = {
    anthropic: !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'REPLACE_WITH_REAL_KEY',
    openai: !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'REPLACE_WITH_REAL_KEY',
    supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabase_service: !!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_KEY.startsWith('REPLACE'),
    evolution: !!process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_URL !== 'REPLACE_WITH_EVOLUTION_URL',
  }
  const allOk = Object.values(checks).every(Boolean)
  return Response.json({ status: allOk ? 'ok' : 'partial', checks, ts: new Date().toISOString() })
}
