import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { signOut } from "./actions"

// Belt-and-suspenders auth gate -- middleware already redirects, but this
// keeps every route under (app) safe even if the matcher config drifts.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <Link href="/decisions" className="text-sm font-medium">
          Called It
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  )
}
