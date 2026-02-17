"use client";

import { LogOut, Settings, User, Camera, Upload, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
interface UserProfileMenuProps {
    name: string;
    email?: string;
    role: "student" | "admin" | "super_admin";
}

import { ImageCropper } from "@/components/ui/image-cropper";

export function UserProfileMenu({ name, email, role, avatarUrl }: UserProfileMenuProps & { avatarUrl?: string | null }) {
    const router = useRouter();
    const supabase = createClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(avatarUrl || null);
    const [showCropper, setShowCropper] = useState(false);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [showManagement, setShowManagement] = useState(false);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) { // 5MB limit for initial selection
            alert("File size must be less than 5MB");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setSelectedFile(reader.result as string);
            setShowCropper(true);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = async () => {
        if (!confirm("Are you sure you want to remove your profile image?")) return;

        setIsUploading(true);
        setShowManagement(false);
        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error("No user found");

            if (role === 'student') {
                const { error: updateError } = await supabase
                    .from('students')
                    .update({ avatar_url: null } as any)
                    .eq('user_id', user.id);
                if (updateError) throw updateError;
            } else {
                const { error: updateError } = await supabase.auth.updateUser({
                    data: { avatar_url: null }
                });
                if (updateError) throw updateError;
            }

            setCurrentAvatarUrl(null);
            router.refresh();
            toast.success("Profile image removed");
        } catch (error: any) {
            console.error('Error removing image:', error);
            alert(`Failed to remove image: ${error.message || "Unknown error"}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        setShowCropper(false);
        setIsUploading(true);

        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error("No user found");

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

            if (role === 'student') {
                const { error: updateError } = await supabase
                    .from('students')
                    .update({ avatar_url: newUrl } as any)
                    .eq('user_id', user.id);
                if (updateError) throw updateError;
            } else {
                const { error: updateError } = await supabase.auth.updateUser({
                    data: { avatar_url: newUrl }
                });
                if (updateError) throw updateError;
            }

            setCurrentAvatarUrl(newUrl);
            router.refresh();
        } catch (error: any) {
            console.error('Error uploading image:', error);
            alert(`Failed to upload image: ${error.message || "Unknown error"}`);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
            setSelectedFile(null);
        }
    };

    return (
        <>
            <input
                type="file"
                id="avatar-upload"
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

            <Dialog open={showManagement} onOpenChange={setShowManagement}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Profile Image</DialogTitle>
                        <DialogDescription>
                            Manage your profile picture. High quality images are recommended.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center py-6 gap-6">
                        <div className="relative w-32 h-32">
                            <div className="absolute inset-0 rounded-full border-2 border-dashed border-neutral-200 z-0 scale-110"></div>
                            <div className="w-full h-full rounded-full overflow-hidden border-2 border-black bg-neutral-100 relative z-10">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={currentAvatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${name}&radius=50`}
                                    alt={name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 w-full gap-3">
                            <Button
                                onClick={() => {
                                    fileInputRef.current?.click();
                                    setShowManagement(false);
                                }}
                                className="w-full bg-black text-white hover:bg-neutral-800"
                            >
                                <Camera className="mr-2 h-4 w-4" />
                                {currentAvatarUrl ? "Change Image" : "Upload New Image"}
                            </Button>
                            {currentAvatarUrl && (
                                <Button
                                    variant="outline"
                                    onClick={handleRemoveImage}
                                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove Current Image
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-3 pl-4 border-l border-neutral-200 outline-none group">
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-semibold group-hover:text-black transition-colors">
                                {name || "User"}
                            </div>
                            <div className="text-xs text-neutral-500">{email}</div>
                        </div>
                        <div className="relative w-9 h-9 shrink-0">
                            <div className="absolute inset-0 rounded-full border border-neutral-200 group-hover:border-neutral-300 transition-colors z-20 pointer-events-none"></div>
                            <div className="w-full h-full rounded-full overflow-hidden bg-neutral-100 z-10 relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={currentAvatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${name}&radius=50`}
                                    alt={name}
                                    className={`w-full h-full object-cover transition-opacity ${isUploading ? 'opacity-50' : 'opacity-100'}`}
                                />
                            </div>
                        </div>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end">
                    <DropdownMenuLabel className="font-normal p-4">
                        <div className="flex items-center gap-4">
                            <div className="relative w-12 h-12 shrink-0">
                                <div className="absolute inset-0 rounded-full border border-neutral-200 z-20 pointer-events-none"></div>
                                <div className="w-full h-full rounded-full overflow-hidden bg-neutral-100 z-10 relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={currentAvatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${name}&radius=50`}
                                        alt={name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col space-y-1 overflow-hidden">
                                <p className="text-sm font-medium leading-none truncate">{name}</p>
                                <p className="text-xs leading-none text-muted-foreground truncate">
                                    {email}
                                </p>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                    {role}
                                </p>
                            </div>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        {role === "student" && (
                            <DropdownMenuItem onClick={() => router.push("/student/profile")}>
                                <User className="mr-2 h-4 w-4" />
                                <span>My Profile</span>
                            </DropdownMenuItem>
                        )}

                        <DropdownMenuItem
                            onSelectItem={() => {
                                setShowManagement(true);
                            }}
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            <span>{isUploading ? "Uploading..." : "Upload Image"}</span>
                        </DropdownMenuItem>

                        {(role === "admin" || role === "super_admin") && (
                            <DropdownMenuItem onClick={() => router.push("/admin/settings")}>
                                <Settings className="mr-2 h-4 w-4" />
                                <span>System Settings</span>
                            </DropdownMenuItem>
                        )}
                        {role === "student" && (
                            <DropdownMenuItem onClick={() => router.push("/student/settings")}>
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Settings</span>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Sign Out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}
