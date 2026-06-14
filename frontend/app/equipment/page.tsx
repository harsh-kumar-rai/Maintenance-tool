import { PageHeader } from "@/components/page-header"
import { EquipmentList } from "@/components/equipment-list"

export default function EquipmentPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="Equipment"
        description="All monitored assets with health, criticality and remaining useful life"
      />
      <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <EquipmentList />
      </main>
    </div>
  )
}
