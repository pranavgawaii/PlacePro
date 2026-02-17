import type { Metadata } from "next";
import { AnalyticsPageClient } from "@/components/admin/analytics-page";

export const metadata: Metadata = {
  title: "Analytics | PlacePro Admin",
  description: "Placement analytics dashboard for campus administrators."
};

export default function AnalyticsPage() {
  return <AnalyticsPageClient />;
}
