import { Suspense } from "react"
import { PageHeader } from "@/components/page-header"
import { ReportsView } from "@/components/reports-view"

export default function ReportsPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="Reports & Logbook"
        description="AI-generated maintenance reports and the auto-recorded digital logbook of plant activity"
      />
      <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Suspense>
          <ReportsView />
        </Suspense>
      </main>
    </div>
  )
}
