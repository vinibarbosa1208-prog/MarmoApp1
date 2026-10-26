// Textos das regras do plano. RASCUNHO — precisa ser revisado pelo
// advogado antes de abrir para o público (ver doc do modelo de negócio).
export function regrasDoPlano(prazoDias: number): { pergunta: string; resposta: string }[] {
  return [
    {
      pergunta: 'Quando eu recebo minha pia?',
      resposta: `Quando o valor total estiver pago. A partir da quitação, a gente mede, produz e instala em até ${prazoDias} dias. Você acompanha cada etapa aqui no seu painel.`,
    },
    {
      pergunta: 'Posso pagar mais rápido?',
      resposta: 'Pode. Adiante qualquer valor a partir de R$ 50 ou quite o restante de uma vez pelo Pix. Quem quita antes entra antes na fila de produção.',
    },
    {
      pergunta: 'E se eu atrasar uma parcela?',
      resposta: 'Não tem multa nem juros. A data da sua pia só anda para frente: ela é instalada quando o valor completar. Se precisar dar uma pausa, fale com a gente pelo WhatsApp.',
    },
    {
      pergunta: 'O preço pode mudar?',
      resposta: 'O valor da sua pia fica congelado no dia da adesão, desde que o plano seja quitado em até 18 meses.',
    },
    {
      pergunta: 'E se eu desistir?',
      resposta: 'Você recebe de volta o que pagou, descontada uma taxa de 10%, em até 60 dias.',
    },
    {
      pergunta: 'O que está incluso?',
      resposta: 'Bancada de 2,50 m × 0,60 m com frontão de 10 cm, recorte e cuba de inox, acabamento, medição e instalação no endereço cadastrado. Medidas maiores, recortes extras ou endereço fora da área têm valor à parte, combinado antes da produção.',
    },
    {
      pergunta: 'Precisa de cartão ou consulta ao SPC?',
      resposta: 'Não. O pagamento é por Pix e não fazemos consulta de crédito.',
    },
  ]
}
