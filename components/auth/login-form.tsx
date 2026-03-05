"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password
        })
      });

      // Handle cases where the component might unmount or signal aborts in Next.js 15/React 19
      const text = await response.text();
      let payload: { success?: boolean; error?: string; redirectTo?: string } | null = null;

      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }

      if (!response.ok || !payload?.success) {
        toast.error(payload?.error ?? "Unable to sign in. Please try again.");
        return;
      }

      toast.success("Login successful");
      // Use router.push/replace and wait for it
      router.replace(payload.redirectTo ?? "/student/dashboard");
      router.refresh();
    } catch (err: any) {
      // Ignore AbortError as it's often a framework artifact in Next.js 15 during navigation
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        console.debug("Fetch aborted (expected during navigation)");
        return;
      }

      console.error("Login unexpected error:", err);
      toast.error("Network error: unable to reach login service.");
    } finally {
      if (loading) setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-6">
          <div className="h-12 w-12 bg-black rounded-lg flex items-center justify-center">
            <img src="/brand/logo.png" alt="PlacePro" className="w-8 h-8 object-contain invert brightness-0" />
            {/* Fallback if logo is white/transparent, or just use a placeholder icon if image fails. 
                 Since I can't see the image, I'll assume the user wants the branding. 
                 Using a black box for high contrast professional look. */}
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Sign in to PlacePro
        </h1>
        <p className="text-sm text-neutral-500">
          Enter your credentials to access the portal
        </p>
      </div>

      <Card className="border-neutral-200 shadow-sm bg-white rounded-lg overflow-hidden">
        <CardContent className="p-8">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-neutral-900 font-medium text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="h-10 border-neutral-300 focus:border-black focus:ring-0 rounded-md bg-white text-neutral-900 placeholder:text-neutral-400"
                placeholder="student@placepro.in"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-neutral-900 font-medium text-sm">Password</Label>
                <Link href="#" className="text-xs font-medium text-neutral-500 hover:text-neutral-900 underline underline-offset-4">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="h-10 border-neutral-300 focus:border-black focus:ring-0 rounded-md bg-white text-neutral-900 pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-900 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button
              className="w-full h-10 bg-neutral-900 hover:bg-black text-white font-medium rounded-md transition-colors"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="pt-8 border-t border-neutral-100 flex flex-col items-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-4">Institutional Helpdesk</p>
        <div className="relative group w-full">
          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=admin@placepro.in&su=PlacePro%20Support%20Request"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 px-8 py-3 bg-neutral-50 hover:bg-black hover:text-white border border-neutral-200 hover:border-black transition-all duration-300 relative group w-full rounded-sm"
          >
            <span className="text-[12px] font-bold tracking-tight">Contact System Administrator</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />

            {/* Architectural Dots for Premium Look */}
            <div className="absolute top-1 left-1 w-1 h-1 bg-neutral-300 group-hover:bg-white rounded-full transition-colors"></div>
            <div className="absolute top-1 right-1 w-1 h-1 bg-neutral-300 group-hover:bg-white rounded-full transition-colors"></div>
            <div className="absolute bottom-1 left-1 w-1 h-1 bg-neutral-300 group-hover:bg-white rounded-full transition-colors"></div>
            <div className="absolute bottom-1 right-1 w-1 h-1 bg-neutral-300 group-hover:bg-white rounded-full transition-colors"></div>
          </a>
        </div>
        <p className="mt-4 text-[11px] text-neutral-400 font-medium italic">Verify credentials via your department TPO coordinator.</p>
      </div>
    </div>
  );
}
