"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  Camera,
  Fingerprint,
  Loader2,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  Upload,
  User as UserIcon,
  Users
} from "lucide-react";

import { AdminUsersTab } from "@/components/admin/settings/AdminUsersTab";
import { ImageCropper } from "@/components/ui/image-cropper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short"
});

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return dateTimeFormatter.format(parsed);
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const {
        data: { user: authUser }
      } = await supabase.auth.getUser();

      if (!authUser) {
        setLoading(false);
        return;
      }

      setUser(authUser);

      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authUser.id)
        .maybeSingle();

      setRole(roleRow?.role || null);
      setAvatarUrl(authUser.user_metadata?.avatar_url ?? null);
      setProfileName(authUser.user_metadata?.name ?? "");
    } catch (error) {
      console.error("Error fetching admin profile:", error);
      toast.error("Unable to load administrator settings.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile(reader.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!user) return;

    setShowCropper(false);
    const toastId = toast.loading("Updating administrator photo...");

    try {
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const file = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });

      const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
      const nextAvatarUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: nextAvatarUrl }
      });
      if (updateError) throw updateError;

      setAvatarUrl(nextAvatarUrl);
      toast.success("Administrator photo updated successfully.", { id: toastId });
      await fetchProfile();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Upload failed";
      toast.error(message, { id: toastId });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSelectedFile(null);
    }
  };

  const handleUpdateProfile = async () => {
    if (!profileName.trim()) return;

    setIsUpdatingProfile(true);
    const toastId = toast.loading("Saving administrator profile...");

    try {
      const { error } = await supabase.auth.updateUser({
        data: { name: profileName.trim() }
      });

      if (error) throw error;

      toast.success("Profile updated successfully.", { id: toastId });
      await fetchProfile();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update profile";
      toast.error(message, { id: toastId });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;

    setIsResetting(true);
    const toastId = toast.loading("Sending password reset email...");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin/settings`
      });

      if (error) throw error;

      toast.success("Password reset link sent successfully.", { id: toastId });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to send reset link";
      toast.error(message, { id: toastId });
    } finally {
      setIsResetting(false);
    }
  };

  const handleSignOutCurrentSession = async () => {
    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast.error(error.message || "Failed to sign out.");
      setIsSigningOut(false);
      return;
    }

    toast.success("Signed out successfully.");
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-3xl border border-neutral-200 bg-white">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-neutral-900">Preparing System Control</p>
          <p className="text-sm text-neutral-500">Loading administrator identity and security preferences.</p>
        </div>
      </div>
    );
  }

  const isSuperAdmin = role === "super_admin";
  const isProfileDirty = profileName.trim() !== (user?.user_metadata?.name ?? "");

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      <div className="rounded-3xl border border-neutral-200 bg-white px-6 py-6 shadow-sm sm:px-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-neutral-500">System Control</div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Administrator Settings</h1>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Manage your administrative identity, security posture, and access controls from one clean workspace.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[460px]">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Access Level</div>
              <div className="mt-2 flex items-center gap-2">
                <Badge className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50">
                  {role?.replace("_", " ") || "Admin"}
                </Badge>
                {isSuperAdmin ? (
                  <Badge className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-neutral-700 hover:bg-white">
                    Root Access
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Recovery Email</div>
              <div className="mt-2 text-sm font-medium text-neutral-900">{user?.email || "Not available"}</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Account Created</div>
              <div className="mt-2 text-sm font-medium text-neutral-900">{formatDateTime(user?.created_at)}</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Last Sign-In</div>
              <div className="mt-2 text-sm font-medium text-neutral-900">{formatDateTime(user?.last_sign_in_at)}</div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="w-full flex-wrap rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-sm sm:w-fit">
          <TabsTrigger
            value="profile"
            activeIndicatorClassName="bg-neutral-950 shadow-none"
            className="rounded-xl px-4 py-2.5 text-sm data-[state=active]:text-white"
          >
            <UserIcon className="mr-2 inline h-4 w-4" />
            Profile
          </TabsTrigger>
          {isSuperAdmin ? (
            <TabsTrigger
              value="admins"
              activeIndicatorClassName="bg-neutral-950 shadow-none"
              className="rounded-xl px-4 py-2.5 text-sm data-[state=active]:text-white"
            >
              <Users className="mr-2 inline h-4 w-4" />
              Admin Access
            </TabsTrigger>
          ) : null}
          <TabsTrigger
            value="security"
            activeIndicatorClassName="bg-neutral-950 shadow-none"
            className="rounded-xl px-4 py-2.5 text-sm data-[state=active]:text-white"
          >
            <Lock className="mr-2 inline h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 focus-visible:outline-none">
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="rounded-3xl border-neutral-200 shadow-sm">
              <CardHeader className="border-b border-neutral-100 pb-5">
                <CardTitle className="flex items-center gap-2 text-xl text-neutral-950">
                  <Fingerprint className="h-5 w-5 text-neutral-500" />
                  Administrator Identity
                </CardTitle>
                <CardDescription>Core identity shown across the admin workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="group relative">
                    <div className="relative h-32 w-32 overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-100 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.email}&radius=20`}
                        alt="Administrator avatar"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
                        <Camera className="h-7 w-7 text-white" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-900 bg-neutral-950 text-white shadow-lg transition hover:bg-neutral-800"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-neutral-950">{profileName || user?.email || "Administrator"}</h2>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Badge className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-neutral-700 hover:bg-white">
                        {role?.replace("_", " ") || "Admin"}
                      </Badge>
                      <Badge className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-green-700 hover:bg-green-50">
                        Verified administrator
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Recovery Email</div>
                    <div className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-neutral-900">
                      <Mail className="h-4 w-4 text-neutral-400" />
                      {user?.email || "Not available"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Last Sign-In</div>
                    <div className="mt-2 text-sm font-medium text-neutral-900">{formatDateTime(user?.last_sign_in_at)}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Provisioned On</div>
                    <div className="mt-2 text-sm font-medium text-neutral-900">{formatDateTime(user?.created_at)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-3xl border-neutral-200 shadow-sm">
                <CardHeader className="border-b border-neutral-100 pb-5">
                  <CardTitle className="text-xl text-neutral-950">Profile Preferences</CardTitle>
                  <CardDescription>Update the administrator name used in the portal and outgoing admin experiences.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="admin-name">Administrator Name</Label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                        <Input
                          id="admin-name"
                          value={profileName}
                          onChange={(event) => setProfileName(event.target.value)}
                          className="h-11 rounded-xl border-neutral-200 pl-9"
                          placeholder="Enter administrator display name"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-email">Recovery Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                        <Input id="admin-email" value={user?.email || ""} disabled className="h-11 rounded-xl border-neutral-200 bg-neutral-50 pl-9 text-neutral-500" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-role">Access Role</Label>
                      <Input id="admin-role" value={role?.replace("_", " ") || "Admin"} disabled className="h-11 rounded-xl border-neutral-200 bg-neutral-50 capitalize text-neutral-500" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-neutral-500">
                      Changes update your administrator identity immediately across the dashboard.
                    </p>
                    <Button
                      className="h-11 rounded-xl px-5"
                      disabled={isUpdatingProfile || !profileName.trim() || !isProfileDirty}
                      onClick={handleUpdateProfile}
                    >
                      {isUpdatingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="rounded-3xl border-neutral-200 shadow-sm">
                  <CardContent className="space-y-2 p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Security Posture</div>
                    <div className="text-lg font-semibold text-neutral-950">Managed</div>
                    <p className="text-sm leading-6 text-neutral-500">Password resets and session controls stay centralized under the security tab.</p>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-neutral-200 shadow-sm">
                  <CardContent className="space-y-2 p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Identity Source</div>
                    <div className="text-lg font-semibold text-neutral-950">Supabase Auth</div>
                    <p className="text-sm leading-6 text-neutral-500">Avatar and administrator metadata remain synced with your authenticated account.</p>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-neutral-200 shadow-sm">
                  <CardContent className="space-y-2 p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Workspace Coverage</div>
                    <div className="text-lg font-semibold text-neutral-950">Full Admin</div>
                    <p className="text-sm leading-6 text-neutral-500">Changes here affect how you appear across Broadcasts, student workflows, and admin tasks.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {isSuperAdmin ? (
          <TabsContent value="admins" className="space-y-6 focus-visible:outline-none">
            <div className="rounded-3xl border border-neutral-200 bg-white px-6 py-6 shadow-sm">
              <div className="max-w-3xl space-y-2">
                <h2 className="text-2xl font-semibold text-neutral-950">Administrator Access</h2>
                <p className="text-sm leading-6 text-neutral-500">
                  Manage privileged users, review access state, and control who can operate within the PlacePro admin workspace.
                </p>
              </div>
            </div>
            <AdminUsersTab isSuperAdmin={isSuperAdmin} />
          </TabsContent>
        ) : null}

        <TabsContent value="security" className="space-y-6 focus-visible:outline-none">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <Card className="rounded-3xl border-neutral-200 shadow-sm">
                <CardHeader className="border-b border-neutral-100 pb-5">
                  <CardTitle className="flex items-center gap-2 text-xl text-neutral-950">
                    <Lock className="h-5 w-5 text-neutral-500" />
                    Access Security
                  </CardTitle>
                  <CardDescription>Control password recovery and monitor the current administrative session posture.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-neutral-900">Password Reset</p>
                      <p className="text-sm leading-6 text-neutral-500">
                        Send a one-time secure reset link to <span className="font-medium text-neutral-900">{user?.email}</span>.
                      </p>
                    </div>
                    <Button variant="outline" className="h-11 rounded-xl border-neutral-200 px-5" onClick={handleResetPassword} disabled={isResetting}>
                      {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {isResetting ? "Sending..." : "Send Reset Link"}
                    </Button>
                  </div>

                  <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-neutral-900">Current Session</p>
                      <p className="text-sm leading-6 text-neutral-500">
                        Sign out this administrator session from the current device if you are finished working.
                      </p>
                    </div>
                    <Button variant="outline" className="h-11 rounded-xl border-neutral-200 px-5" onClick={handleSignOutCurrentSession} disabled={isSigningOut}>
                      {isSigningOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                      {isSigningOut ? "Signing out..." : "Sign Out"}
                    </Button>
                  </div>

                  <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-neutral-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-neutral-900">Multi-Factor Authentication</p>
                      <p className="text-sm leading-6 text-neutral-500">
                        Additional security factors are planned for a future release of the admin workspace.
                      </p>
                    </div>
                    <Badge className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-neutral-600 hover:bg-neutral-50">
                      Coming Soon
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="rounded-3xl border-neutral-200 shadow-sm">
                <CardHeader className="border-b border-neutral-100 pb-5">
                  <CardTitle className="flex items-center gap-2 text-xl text-neutral-950">
                    <ShieldCheck className="h-5 w-5 text-neutral-500" />
                    Security Notes
                  </CardTitle>
                  <CardDescription>Quick reference for how this control surface behaves today.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-6">
                  {[
                    "Password recovery is sent only to the verified administrator email.",
                    "Avatar and profile metadata are stored against the authenticated admin record.",
                    "Super admins can review and manage additional administrator access from the access tab."
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm leading-6 text-neutral-600">
                      {item}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-red-200 shadow-sm">
                <CardHeader className="border-b border-red-100 pb-5">
                  <CardTitle className="text-xl text-red-700">Sensitive Actions</CardTitle>
                  <CardDescription>Use these controls deliberately when handling privileged sessions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-6">
                  <div className="rounded-2xl bg-red-50 px-4 py-4 text-sm leading-6 text-red-700">
                    If you suspect account misuse, reset the password first and then sign out the current session immediately.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/png, image/jpeg, image/jpg, image/webp"
        onChange={handleFileChange}
      />

      <ImageCropper
        open={showCropper}
        imageSrc={selectedFile}
        onCancel={() => {
          setShowCropper(false);
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
