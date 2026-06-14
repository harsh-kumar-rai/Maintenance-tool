import { EquipmentDetailView } from "@/components/equipment-detail-view"

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <EquipmentDetailView id={id} />
}
