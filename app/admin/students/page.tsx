import type { Metadata } from "next";
import { StudentsTable } from "@/components/admin/students-table";

export const metadata: Metadata = {
  title: "Students | PlacePro Admin",
  description: "Manage student records, filters, verification, and exports."
};

export default function AdminStudentsPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Students</h1>
      <StudentsTable />
    </section>
  );
}
