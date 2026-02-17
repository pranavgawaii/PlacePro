"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Camera, Upload, Lock, Shield, User as UserIcon, Mail, Fingerprint, LogOut } from "lucide-react";
import { ImageCropper } from "@/components/ui/image-cropper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function StudentSettingsPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [studentProfile, setStudentProfile] = useState<any>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [showCropper, setShowCropper] = useState(false);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Tab state
    const [activeTab, setActiveTab] = useState<"profile" | "security" | "privacy">("profile");

    // Password reset state
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setUser(user);

            const { data: student } = await supabase
                .from('students')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (student) {
                setStudentProfile(student);
                setAvatarUrl((student as any).avatar_url);
            }
        } catch (error) {
            console.error("Error fetching student profile:", error);
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
        const toastId = toast.loading("Updating your profile picture...");

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

            // Update student record
            const { error: updateError } = await supabase
                .from('students')
                .update({ avatar_url: newUrl } as any)
                .eq('user_id', user.id);

            if (updateError) throw updateError;

            setAvatarUrl(newUrl);
            toast.success("Profile picture updated!", { id: toastId });
            window.location.reload();
        } catch (error: any) {
            console.error('Error uploading image:', error);
            toast.error(`Error: ${error.message || "Something went wrong"}`, { id: toastId });
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setSelectedFile(null);
        }
    };

    const handleResetPassword = async () => {
        if (!user?.email) return;
        setIsResetting(true);
        const toastId = toast.loading("Sending password reset email...");

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/student/settings`,
            });

            if (error) throw error;
            toast.success("Password reset link sent to your email!", { id: toastId });
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
                <p className="text-neutral-500 font-medium">Loading your settings...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="mb-10">
                <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Settings</h1>
                <p className="text-neutral-500 mt-2 font-medium">Manage your profile, security, and account preferences.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Navigation Sidebar */}
                <div className="md:col-span-1 space-y-2">
                    <button
                        onClick={() => setActiveTab("profile")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all border ${activeTab === "profile"
                            ? "bg-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            : "bg-neutral-50/50 hover:bg-white border-transparent text-neutral-500 hover:text-black hover:border-black"
                            }`}
                    >
                        <UserIcon className="w-4 h-4" />
                        Profile Settings
                    </button>
                    <button
                        onClick={() => setActiveTab("security")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all group border ${activeTab === "security"
                            ? "bg-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black font-bold"
                            : "bg-neutral-50/50 hover:bg-white border-transparent text-neutral-500 hover:text-black hover:border-black"
                            }`}
                    >
                        <Lock className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        Account Security
                    </button>
                    <button
                        onClick={() => setActiveTab("privacy")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all group border ${activeTab === "privacy"
                            ? "bg-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black font-bold"
                            : "bg-neutral-50/50 hover:bg-white border-transparent text-neutral-500 hover:text-black hover:border-black"
                            }`}
                    >
                        <Shield className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        Privacy & Safety
                    </button>
                    <Separator className="my-4" />
                    <button
                        onClick={() => supabase.auth.signOut()}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 hover:bg-red-100 border-2 border-transparent hover:border-red-200 rounded-lg text-sm font-bold text-red-600 transition-all group"
                    >
                        <LogOut className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                        Logout Account
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="md:col-span-2">
                    {activeTab === "profile" && (
                        <Card className="border-2 border-black shadow-sharp rounded-xl overflow-hidden">
                            <CardHeader className="bg-neutral-50 border-b border-neutral-100">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Fingerprint className="w-5 h-5" />
                                    Public Profile
                                </CardTitle>
                                <CardDescription>Update your photo and personal details.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-8 space-y-8">
                                <div className="flex flex-col sm:flex-row items-center gap-8">
                                    <div className="relative group">
                                        <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-neutral-100 bg-neutral-50 shadow-sm relative ring-4 ring-white">
                                            <img
                                                src={avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${studentProfile?.name || user?.email}&radius=50`}
                                                alt="Profile"
                                                className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                                            />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                <Camera className="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="absolute -bottom-1 -right-1 p-2.5 bg-black text-white rounded-xl hover:bg-neutral-800 transition-all shadow-lg active:scale-95 z-20"
                                        >
                                            <Camera className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="flex-1 w-full space-y-4">
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Full Name</Label>
                                                <div className="relative">
                                                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                                    <Input value={studentProfile?.name || "N/A"} disabled className="pl-9 bg-neutral-50/50 font-semibold" />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Email Address</Label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                                    <Input value={user?.email || "N/A"} disabled className="pl-9 bg-neutral-50/50 font-semibold" />
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-neutral-500 font-medium">
                                            Note: Contact admin to update your name or official email.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === "security" && (
                        <Card className="border-2 border-black shadow-sharp rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <CardHeader className="bg-neutral-50 border-b border-neutral-100">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Lock className="w-5 h-5 text-orange-600" />
                                    Account Security
                                </CardTitle>
                                <CardDescription>Manage how you access your account.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div className="flex items-center justify-between p-4 border rounded-xl border-dashed bg-orange-50/30">
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-neutral-900">Reset Password</p>
                                        <p className="text-xs text-neutral-500 font-medium">Request a secure link to change your password.</p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="border-black font-bold h-9 px-4 active:translate-y-0.5 transition-transform"
                                        onClick={handleResetPassword}
                                        disabled={isResetting}
                                    >
                                        {isResetting ? "Sending..." : "Send Reset Link"}
                                    </Button>
                                </div>

                                <Separator />

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-4 border border-neutral-100 rounded-xl space-y-2">
                                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Current Branch</p>
                                        <p className="text-sm font-bold">{studentProfile?.branch || "Not Assigned"}</p>
                                    </div>
                                    <div className="p-4 border border-neutral-100 rounded-xl space-y-2">
                                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Graduation Year</p>
                                        <p className="text-sm font-bold">{studentProfile?.batch_year || "N/A"}</p>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-neutral-50/50 border-t border-neutral-100 px-6 py-4">
                                <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
                                    <Shield className="w-3 h-3" />
                                    Your account is secured with end-to-end encryption.
                                </div>
                            </CardFooter>
                        </Card>
                    )}

                    {activeTab === "privacy" && (
                        <Card className="border-2 border-black shadow-sharp rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <CardHeader className="bg-neutral-50 border-b border-neutral-100">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-emerald-600" />
                                    Privacy Settings
                                </CardTitle>
                                <CardDescription>Control your profile visibility and data usage.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-20 pb-24 flex flex-col items-center justify-center text-center space-y-4">
                                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center border-2 border-dashed border-emerald-200">
                                    <Shield className="w-8 h-8 text-emerald-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-neutral-900">Privacy Control Center</h3>
                                    <p className="text-sm text-neutral-500 max-w-[280px] mt-1">Advanced privacy controls are being finalized for your account.</p>
                                </div>
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-none font-bold uppercase tracking-widest text-[10px]">Coming Soon</Badge>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

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
