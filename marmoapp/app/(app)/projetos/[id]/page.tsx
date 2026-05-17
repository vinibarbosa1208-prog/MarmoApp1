'use client'

import { use } from 'react'
import ProjetoDetalhe from '@/components/projetos/ProjetoDetalhe'

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <ProjetoDetalhe id={id} />
}
