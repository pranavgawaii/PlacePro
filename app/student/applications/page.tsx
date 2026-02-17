import type { Metadata } from "next";
import { StudentApplicationsPage } from "@/components/student/applications-page";

export const metadata: Metadata = {
  title: "Applications | PlacePro Student",
  description: "Track your company applications and placement status updates."
};

export default function ApplicationsPage() {
  return <StudentApplicationsPage />;
}
