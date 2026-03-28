import { CoordinatorResponsesPage } from "@/components/admin/coordinator/CoordinatorResponsesPage";

type CoordinatorFormResponsesRouteProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function CoordinatorFormResponsesRoute({ params }: CoordinatorFormResponsesRouteProps) {
  const { id } = await params;

  return <CoordinatorResponsesPage formId={id} />;
}
