import { requireAdminAuth } from '@/lib/auth-admin'
import Sidebar from '@/components/Sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminAuth()

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col pl-56">
        {children}
      </div>
    </div>
  )
}
