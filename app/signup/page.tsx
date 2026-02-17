import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Student Signup | PlacePro",
  description: "Create your PlacePro student account and complete your placement profile."
};

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <SignupForm />
    </main>
  );
}
