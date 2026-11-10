import { redirect } from 'next/navigation'

// A antiga tela de assinaturas calculava receita pela tabela de preços dos planos,
// o que mostrava valores que ninguém paga. O controle real agora fica em /pagamentos.
export default function AssinaturasPage() {
  redirect('/pagamentos')
}
