import type { Metadata } from "next";
import { ResumeEditorPage } from "@/components/student/resume-editor-page";

export const metadata: Metadata = {
  title: "Resume Builder | PlacePro Student",
  description: "Create and manage tailored resumes for placement applications."
};

export default async function StudentResumeEditorRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResumeEditorPage resumeId={id} />;
}
