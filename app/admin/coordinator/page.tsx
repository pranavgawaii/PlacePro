import { CoordinatorPage } from "@/components/admin/coordinator-page";

type CoordinatorAdminPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export const dynamic = "force-dynamic";

export default async function CoordinatorAdminPage({ searchParams }: CoordinatorAdminPageProps) {
  const params = await searchParams;
  const tab = params.tab;
  const initialTab = tab === "attendance" || tab === "forms" ? tab : "coordinators";

  return <CoordinatorPage initialTab={initialTab} />;
}
