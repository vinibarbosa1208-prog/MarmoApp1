# Rotina de marketing — 15 minutos por semana

## SEGUNDA-FEIRA (10 minutos)
1. Você recebe o email automático às 4h BRT com métricas da semana anterior
2. Abra o Claude Code na pasta `marmoapp-admin`
3. Cole: `"Aja como marketing-editorial. Estamos na semana [1/2/3/4] do ciclo. Gere o pacote completo."`
4. Revise os 4 carrosséis e 4 legendas
5. Aprove ou peça ajustes: `"Ajuste o carrossel 2 para falar mais sobre preço"`
6. Salve os arquivos aprovados

## TERÇA A SEXTA (2 minutos por dia)
- Publique 1 post por dia no @marmoapp_oficial
- Use a legenda gerada pelo agente
- Adicione os hashtags sugeridos

## SEXTA-FEIRA (3 minutos)
1. Exporte métricas do Instagram Insights (printscreen ou CSV)
2. Exporte métricas do Meta Ads (se tiver campanhas ativas)
3. Cole no Claude Code: `"Aja como marketing-metricas. Analise estes dados: [colar dados]"`
4. Salve as recomendações para a próxima semana

## QUANDO CRIAR ANÚNCIOS
1. Cole no Claude Code: `"Aja como marketing-ads. Quero criar uma campanha de [objetivo]"`
2. Responda as 3 perguntas do agente
3. Receba o pacote completo de criativos e copies
4. Suba manualmente no Meta Ads Manager (business.facebook.com)
5. Use as segmentações e orçamentos recomendados

## CICLO DE CONTEÚDO (repete a cada 4 semanas)
| Semana | Tema | Foco |
|--------|------|------|
| 1 | Dor financeira | "Quanto você perde sem controle de margem" |
| 2 | Solução | "MarmoApp em 2 minutos" |
| 3 | Prova social | "Real Pedras antes e depois" |
| 4 | IA | "Agente Antônio atendendo clientes 24h" |

## AGENTES DISPONÍVEIS

| Agente | Quando usar | Como acionar |
|--------|-------------|--------------|
| `marketing-editorial` | Segunda-feira | "Aja como marketing-editorial. Semana X do ciclo." |
| `marketing-ads` | Ao criar campanha | "Aja como marketing-ads. Quero campanha de [objetivo]." |
| `marketing-metricas` | Sexta-feira | "Aja como marketing-metricas. Analise: [dados]" |

## PAINEL DE MARKETING
Acesse: https://admin.marmoapp.com/marketing

Mostra em tempo real:
- Leads da semana e funil completo
- Calendário editorial com status dos posts
- Status das campanhas Meta Ads
- Pipeline: Visitantes → Leads → Trials → Pagantes
