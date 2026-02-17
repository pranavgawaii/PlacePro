"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { BRANCHES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { Branch } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  prn: z.string().min(3, "Enrolment Number is required"),
  branch: z.custom<Branch>((value) => typeof value === "string" && BRANCHES.includes(value as Branch), {
    message: "Select a valid branch"
  }),
  batchYear: z.coerce.number().min(2024).max(2035)
});

export function SignupForm() {
  const supabase = createClient();
  const router = useRouter();

  const [formState, setFormState] = useState({
    name: "",
    email: "",
    password: "",
    prn: "",
    branch: BRANCHES[0],
    batchYear: 2027
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const parsed = useMemo(() => signupSchema.safeParse(formState), [formState]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid form data";
      toast.error(firstError);
      return;
    }

    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          name: parsed.data.name
        }
      }
    });

    if (authError) {
      toast.error(authError.message);
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      toast.error("Unable to create account. Try again.");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("students").insert({
      user_id: userId,
      name: parsed.data.name,
      email: parsed.data.email,
      prn: parsed.data.prn,
      branch: parsed.data.branch,
      batch_year: parsed.data.batchYear
    });

    if (profileError) {
      toast.error(profileError.message);
      setLoading(false);
      return;
    }

    const { error: roleError } = await supabase.from("user_roles").upsert({
      user_id: userId,
      role: "student"
    });

    if (roleError) {
      toast.error(roleError.message);
      setLoading(false);
      return;
    }

    toast.success("Signup complete");
    router.replace("/student/dashboard");
    router.refresh();
    setLoading(false);
  };

  return (
    <Card className="w-full max-w-lg border-white/40 bg-white/90 shadow-xl backdrop-blur">
      <CardHeader>
        <CardTitle className="text-2xl">Create student account</CardTitle>
        <CardDescription>Set up your PlacePro profile in one step.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formState.email}
              onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formState.password}
                onChange={(event) => setFormState((prev) => ({ ...prev, password: event.target.value }))}
                required
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 transition-colors"
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

          <div className="space-y-2">
            <Label htmlFor="prn">Enrolment Number</Label>
            <Input
              id="prn"
              value={formState.prn}
              onChange={(event) => setFormState((prev) => ({ ...prev, prn: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch">Batch Year</Label>
            <Input
              id="batch"
              type="number"
              min={2024}
              max={2035}
              value={formState.batchYear}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, batchYear: Number(event.target.value) || 2027 }))
              }
              required
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="branch">Branch</Label>
            <Select
              value={formState.branch}
              onValueChange={(value) => setFormState((prev) => ({ ...prev, branch: value as (typeof BRANCHES)[number] }))}
            >
              <SelectTrigger id="branch" aria-label="Branch">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {BRANCHES.map((branch) => (
                  <SelectItem value={branch} key={branch}>
                    {branch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
          </div>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            Login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
