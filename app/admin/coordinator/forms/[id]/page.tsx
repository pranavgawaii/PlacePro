import { CoordinatorFormBuilderPage } from "@/components/admin/coordinator/CoordinatorFormBuilderPage";

type CoordinatorFormEditPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function CoordinatorFormEditPage({ params }: CoordinatorFormEditPageProps) {
  const { id } = await params;

  return <CoordinatorFormBuilderPage formId={id} />;
}
