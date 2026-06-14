import { PageHeader } from "@/components/page-header"
import { PredictedFailures } from "@/components/predicted-failures"

export default function PredictionsPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="Failure Predictions"
        description="Multi-factor failure likelihood analysis — sensor trends, health scores, RUL estimates and maintenance history"
      />
      <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <PredictedFailures />
      </main>
    </div>
  )
}
