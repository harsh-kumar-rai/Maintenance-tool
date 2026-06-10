import { Suspense } from "react"
import { PageHeader } from "@/components/page-header"
import { KnowledgeBrowser } from "@/components/knowledge-browser"

export default function KnowledgePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="Knowledge Base"
        description="Manuals, SOPs, failure reports and OEM bulletins — searchable by the AI agent"
      />
      <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Suspense>
          <KnowledgeBrowser />
        </Suspense>
      </main>
    </div>
  )
}
