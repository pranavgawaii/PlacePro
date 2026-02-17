"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    User as UserIcon,
    Mail,
    Lock,
    ShieldCheck,
    Upload,
    Camera,
    Fingerprint,
    Loader2,
    LogOut,
    Settings as SettingsIcon
} from "lucide-react";
import { ImageCropper } from "@/components/ui/image-cropper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminUsersTab } from "@/components/admin/settings/AdminUsersTab";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function AdminSettingsPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [role, setRole] = useState<string | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [showCropper, setShowCropper] = useState(false);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Security state
    const [isResetting, setIsResetting] = useState(false);

    // Profile Edit state
    const [profileName, setProfileName] = useState("");
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setUser(user);

            const { data: roleRow } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", user.id)
                .maybeSingle();

            setRole(roleRow?.role || null);
            setAvatarUrl(user.user_metadata?.avatar_url);
            setProfileName(user.user_metadata?.name || "");
        } catch (error) {
            console.error("Error fetching admin profile:", error);
        } finally {
            setLoading(false);
        }
    };

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
        setShowCropper(false);
        const toastId = toast.loading("Updating admin avatar...");

        try {
            const fileName = `${user.id}/${Date.now()}.jpg`;
            const file = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            const newUrl = publicUrlData.publicUrl;

            const { error: updateError } = await supabase.auth.updateUser({
                data: { avatar_url: newUrl }
            });

            if (updateError) throw updateError;

            setAvatarUrl(newUrl);
            toast.success("Profile updated successfully", { id: toastId });
            window.location.reload();
        } catch (error: any) {
            console.error('Error uploading image:', error);
            toast.error(`Error: ${error.message || "Upload failed"}`, { id: toastId });
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setSelectedFile(null);
        }
    };

    const handleUpdateProfile = async () => {
        if (!profileName.trim()) return;
        setIsUpdatingProfile(true);
        const toastId = toast.loading("Updating profile details...");

        try {
            const { error } = await supabase.auth.updateUser({
                data: { name: profileName.trim() }
            });

            if (error) throw error;
            toast.success("Profile updated successfully", { id: toastId });
            fetchProfile();
        } catch (error: any) {
            toast.error(error.message || "Failed to update profile", { id: toastId });
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
                redirectTo: `${window.location.origin}/auth/callback?next=/admin/settings`,
            });

            if (error) throw error;
            toast.success("Password reset link sent to admin email!", { id: toastId });
        } catch (error: any) {
            toast.error(error.message || "Failed to send reset link", { id: toastId });
        } finally {
            setIsResetting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                <p className="text-neutral-500 font-medium">Loading system configurations...</p>
            </div>
        );
    }

    const isSuperAdmin = role === "super_admin";

    return (
        <div className="max-w-6xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-neutral-900">System Control</h1>
                    <p className="text-neutral-500 mt-2 font-medium">Configure administrator preferences and system-wide security.</p>
                </div>
                {isSuperAdmin && (
                    <Badge className="bg-black text-white px-3 py-1 text-xs font-bold uppercase tracking-widest h-fit">
                        Root Access
                    </Badge>
                )}
            </div>

            <Tabs defaultValue="profile" className="w-full space-y-8">
                <TabsList className="bg-neutral-100/50 p-1 border-2 border-black rounded-lg w-fit">
                    <TabsTrigger
                        value="profile"
                        className="data-[state=active]:bg-black data-[state=active]:text-white font-bold px-6 py-2 rounded-md transition-all"
                    >
                        <UserIcon className="w-4 h-4 mr-2" />
                        Admin Profile
                    </TabsTrigger>
                    {isSuperAdmin && (
                        <TabsTrigger
                            value="admins"
                            className="data-[state=active]:bg-black data-[state=active]:text-white font-bold px-6 py-2 rounded-md transition-all"
                        >
                            <ShieldCheck className="w-4 h-4 mr-2" />
                            User Management
                        </TabsTrigger>
                    )}
                    <TabsTrigger
                        value="security"
                        className="data-[state=active]:bg-black data-[state=active]:text-white font-bold px-6 py-2 rounded-md transition-all"
                    >
                        <Lock className="w-4 h-4 mr-2" />
                        Security
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="focus-visible:outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                        <div className="md:col-span-12 lg:col-span-8">
                            <Card className="border-2 border-black shadow-sharp rounded-xl overflow-hidden mb-8">
                                <CardHeader className="bg-neutral-50 border-b border-neutral-100">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Fingerprint className="w-5 h-5" />
                                        Administrative Identity
                                    </CardTitle>
                                    <CardDescription>Managed system identification for this account.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-8 space-y-8">
                                    <div className="flex flex-col sm:flex-row items-center gap-10">
                                        <div className="relative group">
                                            <div className="w-40 h-40 rounded-3xl overflow-hidden border-2 border-black bg-neutral-50 shadow-sm relative ring-4 ring-neutral-50">
                                                <img
                                                    src={avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.email}&radius=20`}
                                                    alt="Admin Avatar"
                                                    className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700"
                                                />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Camera className="w-8 h-8 text-white" />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="absolute -bottom-2 -right-2 p-3 bg-black text-white rounded-2xl hover:bg-neutral-800 transition-all shadow-xl active:scale-90"
                                            >
                                                <Upload className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="flex-1 w-full space-y-5">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Admin Name</Label>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                                        <Input
                                                            value={profileName}
                                                            onChange={(e) => setProfileName(e.target.value)}
                                                            className="pl-9 font-bold border-neutral-200 focus-visible:ring-black"
                                                        />
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        className="bg-black hover:bg-neutral-800 text-white font-bold h-10 px-4"
                                                        disabled={isUpdatingProfile || !profileName.trim() || profileName === user?.user_metadata?.name}
                                                        onClick={handleUpdateProfile}
                                                    >
                                                        {isUpdatingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Recovery Email</Label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                                    <Input value={user?.email || "N/A"} disabled className="pl-9 bg-neutral-50/50 font-bold border-neutral-200" />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 pt-2">
                                                <Badge variant="outline" className="border-black font-bold uppercase text-[10px] tracking-tighter px-3">
                                                    {role?.replace("_", " ") || "Admin"}
                                                </Badge>
                                                <span className="text-[10px] text-neutral-400 font-medium italic">Verified Administrator</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {isSuperAdmin && (
                    <TabsContent value="admins">
                        <AdminUsersTab isSuperAdmin={isSuperAdmin} />
                    </TabsContent>
                )}

                <TabsContent value="security" className="focus-visible:outline-none">
                    <div className="max-w-2xl space-y-6">
                        <Card className="border-2 border-black shadow-sharp rounded-xl overflow-hidden">
                            <CardHeader className="bg-neutral-50 border-b border-neutral-100">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Lock className="w-5 h-5 text-red-600" />
                                    Access Control
                                </CardTitle>
                                <CardDescription>Manage password and authentication tokens.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div className="flex items-center justify-between p-5 border rounded-2xl bg-neutral-50/50 border-dashed border-neutral-300">
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-neutral-900">Admin Password Reset</p>
                                        <p className="text-xs text-neutral-500 font-medium">Sends a secure 1-time link to {user?.email}</p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="border-black font-bold h-10 px-6 active:translate-y-0.5 transition-all hover:bg-black hover:text-white"
                                        onClick={handleResetPassword}
                                        disabled={isResetting}
                                    >
                                        {isResetting ? "Processing..." : "Initiate Reset"}
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between p-5 border rounded-2xl bg-neutral-50/50 border-dashed border-neutral-300 opacity-60 grayscale cursor-not-allowed">
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-neutral-900">Multi-Factor Auth (MFA)</p>
                                        <p className="text-xs text-neutral-500 font-medium">Add an extra layer of security via Authenticator app.</p>
                                    </div>
                                    <Badge className="bg-neutral-200 text-neutral-500 font-bold border-none">SOON</Badge>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="p-6 bg-red-50 border-2 border-red-200 rounded-2xl space-y-4">
                            <div className="flex items-center gap-2 text-red-700">
                                <ShieldCheck className="w-5 h-5" />
                                <h4 className="font-bold text-sm uppercase tracking-wider">Danger Zone</h4>
                            </div>
                            <Separator className="bg-red-200" />
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-red-900">Sign out from all devices</p>
                                    <p className="text-xs text-red-600 font-medium">This will terminate all active administrative sessions.</p>
                                </div>
                                <Button variant="destructive" className="font-bold h-9 bg-red-600 hover:bg-red-700">
                                    Logout All
                                </Button>
                            </div>
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
