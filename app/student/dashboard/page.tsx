import type { Metadata } from "next";
import { StudentDashboardPageSimple } from "@/components/student/dashboard-page-simple";

export const metadata: Metadata = {
  title: "Dashboard | PlacePro Student",
  description: "View and apply to eligible companies on PlacePro."
};

export default function DashboardPage() {
  return <StudentDashboardPageSimple />;
}
