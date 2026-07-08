# Regras obrigatórias para o MarmoApp

## ANTES DE QUALQUER COMMIT E PUSH:
1. Sempre rode: npm run build
2. Se o build falhar, corrija os erros TypeScript antes de fazer push
3. NUNCA faça push com build quebrado
4. Se não conseguir corrigir o erro de TypeScript, NÃO faça push e avise

## PADRÃO DE AUTH:
- Nunca usar createServerClient em componentes client-side
- Para buscar marmoraria_id: usar supabase.auth.getUser() + from('usuarios')
- Sempre envolver saves em try/catch/finally com setLoading(false) no finally

## PADRÃO DE INSERT:
- Sempre incluir marmoraria_id nos inserts
- Nunca assumir que o contexto já tem marmoraria_id disponível
