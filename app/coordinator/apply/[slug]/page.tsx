import { CoordinatorApplicationPage } from "@/components/public/coordinator-application-page";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CoordinatorFormField, CoordinatorFormRecord } from "@/lib/coordinator/types";

type CoordinatorApplicationRouteProps = {
  params: Promise<{ slug: string }>;
};

const isLive = (status: string, isPublic: boolean, deadline: string | null) => {
  if (!isPublic || status !== "active") {
    return false;
  }

  if (!deadline) {
    return true;
  }

  const deadlineDate = new Date(deadline);
  return Number.isNaN(deadlineDate.getTime()) ? true : deadlineDate.getTime() > Date.now();
};

export const dynamic = "force-dynamic";

export default async function CoordinatorApplicationRoute({ params }: CoordinatorApplicationRouteProps) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data: form, error: formError } = await admin.from("coordinator_forms").select("*").eq("slug", slug).maybeSingle();

  if (formError) {
    return <CoordinatorApplicationPage slug={slug} form={null} fields={[]} unavailableReason="We could not load this coordinator form right now." />;
  }

  if (!form) {
    return <CoordinatorApplicationPage slug={slug} form={null} fields={[]} unavailableReason="This coordinator application link does not exist." />;
  }

  const { data: fields, error: fieldsError } = await admin
    .from("coordinator_form_fields")
    .select("*")
    .eq("form_id", form.id)
    .order("sort_order", { ascending: true });

  if (fieldsError) {
    return <CoordinatorApplicationPage slug={slug} form={null} fields={[]} unavailableReason="We could not load the application questions right now." />;
  }

  if (!isLive(form.status, form.is_public, form.deadline)) {
    return (
      <CoordinatorApplicationPage
        slug={slug}
        form={null}
        fields={[]}
        unavailableReason="This coordinator application is currently closed or not yet public. Please contact the placement office for the latest update."
      />
    );
  }

  return (
    <CoordinatorApplicationPage
      slug={slug}
      form={form as CoordinatorFormRecord}
      fields={(fields ?? []) as CoordinatorFormField[]}
    />
  );
}
