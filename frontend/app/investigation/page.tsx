import { Suspense } from "react"
import { PageHeader } from "@/components/page-header"
import { InvestigationView } from "@/components/investigation/investigation-view"

export default function InvestigationPage() {
  return (
    <div className="flex h-svh flex-col">
      <PageHeader
        title="AI Investigation"
        description="Multi-step diagnostic agent with traceable evidence"
      />
      <Suspense>
        <InvestigationView />
      </Suspense>
    </div>
  )
}
