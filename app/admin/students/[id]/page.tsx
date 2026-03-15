import type { Metadata } from "next";

import { StudentDetailPage } from "@/components/admin/student-detail-page";

export const metadata: Metadata = {
  title: "Student Workspace | PlacePro Admin",
  description: "Review and update a student profile, academics, documents, and application activity."
};

export default async function AdminStudentDetailRoute({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <StudentDetailPage studentId={id} />;
}
