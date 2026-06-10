import { PageHeader } from "@/components/page-header"
import { PlannerBoard } from "@/components/planner-board"

export default function PlannerPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="Maintenance Planner"
        description="Priority-ranked action queue with step-by-step procedures and spares"
      />
      <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <PlannerBoard />
      </main>
    </div>
  )
}
