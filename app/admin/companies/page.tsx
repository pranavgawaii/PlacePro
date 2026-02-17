import type { Metadata } from "next";
import { CompaniesPage } from "@/components/admin/companies-page";

export const metadata: Metadata = {
  title: "Companies | PlacePro Admin",
  description: "Create and manage company drives, criteria, and eligible student lists."
};

export default function AdminCompaniesPage() {
  return <CompaniesPage />;
}
