import type { Metadata } from "next";
import { CompanyApplicationsPage } from "@/components/admin/company-applications-page";

export const metadata: Metadata = {
  title: "Company Applications | PlacePro Admin",
  description: "Review and manage applications for a specific company drive."
};

export default async function CompanyApplicationsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompanyApplicationsPage companyId={id} />;
}
