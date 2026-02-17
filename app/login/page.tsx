import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login | PlacePro",
  description: "Login to PlacePro campus placement portal."
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-neutral-50">
      <div className="w-full max-w-[400px]">
        <LoginForm />
      </div>
    </main>
  );
}
