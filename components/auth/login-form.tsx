"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      toast.error("Unable to load user session");
      setLoading(false);
      return;
    }

    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (roleError) {
      toast.error(roleError.message);
      setLoading(false);
      return;
    }

    const role = roleRow?.role;
    toast.success("Login successful");

    if (role === "admin") {
      router.replace("/admin/students");
    } else {
      router.replace("/student/dashboard");
    }

    router.refresh();
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-6">
          <div className="h-12 w-12 bg-black rounded-lg flex items-center justify-center">
            <img src="/logo.png" alt="PlacePro" className="w-8 h-8 object-contain invert brightness-0" />
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

      <div className="text-center text-sm text-neutral-500">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-neutral-900 hover:underline underline-offset-4 pointer-events-none opacity-50">
          Contact Admin
        </Link>
      </div>
    </div>
  );
}
