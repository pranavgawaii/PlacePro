"use client";

import { useEffect, useState } from "react";
import { UserPlus, MoreHorizontal, ShieldCheck, Shield, UserX, UserCheck, Camera, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AddAdminModal } from "./AddAdminModal";
import { ImageCropper } from "@/components/ui/image-cropper";
import { createClient } from "@/lib/supabase/client";
import { useRef } from "react";

type AdminUser = {
    id: string;
    email: string;
    name: string;
    role: "admin" | "super_admin";
    avatar_url?: string | null;
    is_active: boolean;
    last_sign_in_at: string | null;
    created_at: string;
};

interface AdminUsersTabProps {
    isSuperAdmin?: boolean;
}

export function AdminUsersTab({ isSuperAdmin }: AdminUsersTabProps) {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [addModalOpen, setAddModalOpen] = useState(false);

    // Avatar Management state
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [showCropper, setShowCropper] = useState(false);
    const [targetAdmin, setTargetAdmin] = useState<AdminUser | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Rename Management state
    const [renamingAdmin, setRenamingAdmin] = useState<AdminUser | null>(null);
    const [newName, setNewName] = useState("");
    const [isRenaming, setIsRenaming] = useState(false);

    useEffect(() => {
        fetchAdmins();
    }, []);

    const fetchAdmins = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/admin/users");
            if (!response.ok) throw new Error("Failed to fetch admin users");
            const data = await response.json();
            setAdmins(data);
        } catch (error) {
            console.error("Error fetching admins:", error);
            toast.error("Failed to load admin users");
        } finally {
            setLoading(false);
        }
    };

    const toggleAdminStatus = async (admin: AdminUser) => {
        const action = admin.is_active ? "deactivate" : "activate";
        if (!confirm(`Are you sure you want to ${action} this admin?`)) return;

        try {
            const response = await fetch(`/api/admin/users/${admin.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_active: !admin.is_active })
            });

            if (!response.ok) throw new Error();

            toast.success(`Admin ${action}d successfully`);
            fetchAdmins();
        } catch (error) {
            toast.error(`Failed to ${action} admin`);
        }
    };

    const changeRole = async (admin: AdminUser, newRole: "admin" | "super_admin") => {
        try {
            const response = await fetch(`/api/admin/users/${admin.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole })
            });

            if (!response.ok) throw new Error();

            toast.success(`Admin role updated to ${newRole}`);
            fetchAdmins();
        } catch (error) {
            toast.error("Failed to update admin role");
        }
    };

    const handleRenameAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!renamingAdmin || !newName.trim()) return;

        setIsRenaming(true);
        try {
            const response = await fetch(`/api/admin/users/${renamingAdmin.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName.trim() })
            });

            if (!response.ok) throw new Error();

            toast.success("Admin name updated successfully");
            fetchAdmins();
            setRenamingAdmin(null);
        } catch (error) {
            toast.error("Failed to update admin name");
        } finally {
            setIsRenaming(false);
        }
    };

    const handleUpdateAvatarClick = (admin: AdminUser) => {
        setTargetAdmin(admin);
        fileInputRef.current?.click();
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
        if (!targetAdmin) return;
        setShowCropper(false);
        const toastId = toast.loading(`Updating ${targetAdmin.name}'s avatar...`);

        try {
            const fileName = `${targetAdmin.id}/${Date.now()}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, croppedBlob, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) {
                console.error('Supabase upload error:', uploadError);
                throw new Error(`Failed to upload avatar: ${uploadError.message}`);
            }

            const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            const newUrl = publicUrlData.publicUrl;

            // Use the API route to update the metadata and user_roles
            const response = await fetch(`/api/admin/users/${targetAdmin.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ avatar_url: newUrl })
            });

            if (!response.ok) throw new Error("Failed to update avatar in database");

            toast.success("Avatar updated successfully", { id: toastId });
            fetchAdmins();
        } catch (error: any) {
            console.error('Full upload error detail:', error);
            toast.error(`Error: ${error.message || "Upload failed. Check console for details."}`, { id: toastId });
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setSelectedFile(null);
            setTargetAdmin(null);
        }
    };

    const handleRemoveAvatar = async (admin: AdminUser) => {
        if (!confirm(`Are you sure you want to remove ${admin.name}'s avatar?`)) return;

        const toastId = toast.loading("Removing avatar...");
        try {
            const response = await fetch(`/api/admin/users/${admin.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ avatar_url: null })
            });

            if (!response.ok) throw new Error();

            toast.success("Avatar removed", { id: toastId });
            fetchAdmins();
        } catch (error) {
            toast.error("Failed to remove avatar", { id: toastId });
        }
    };

    if (loading) {
        return (
            <div className="space-y-4 pt-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-[400px] w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Admin Team</h2>
                    <p className="text-sm text-neutral-500">Manage your administrative team and their permissions.</p>
                </div>
                <Button onClick={() => setAddModalOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add New Admin
                </Button>
            </div>

            <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-neutral-50">
                        <TableRow>
                            <TableHead className="pl-6">Admin User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Activity</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {admins.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-12 text-center text-neutral-500">
                                    No other admin users found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            admins.map((admin) => (
                                <TableRow key={admin.id} className="group">
                                    <TableCell className="pl-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden border border-neutral-200">
                                                {admin.avatar_url ? (
                                                    <img src={admin.avatar_url} alt={admin.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <span className="text-xs font-bold text-neutral-400">{admin.name[0]}</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-semibold">{admin.name}</span>
                                                <span className="text-xs text-neutral-500">{admin.email}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {admin.role === "super_admin" ? (
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 flex items-center gap-1 px-2">
                                                    <ShieldCheck className="w-3 h-3" />
                                                    Super Admin
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-neutral-50 text-neutral-600 border-neutral-100 flex items-center gap-1 px-2">
                                                    <Shield className="w-3 h-3" />
                                                    Regular Admin
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {admin.is_active ? (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-green-50 text-green-700 border border-green-100">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-red-50 text-red-700 border border-red-100">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                                                Deactivated
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-neutral-500">
                                            {admin.last_sign_in_at
                                                ? new Date(admin.last_sign_in_at).toLocaleDateString()
                                                : "Never"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                {isSuperAdmin && (
                                                    <>
                                                        <DropdownMenuItem onClick={() => handleUpdateAvatarClick(admin)}>
                                                            <Camera className="mr-2 h-4 w-4" />
                                                            Upload New Pic
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => {
                                                            setRenamingAdmin(admin);
                                                            setNewName(admin.name);
                                                        }}>
                                                            <AlertCircle className="mr-2 h-4 w-4" />
                                                            Change Name
                                                        </DropdownMenuItem>
                                                        {admin.avatar_url && (
                                                            <DropdownMenuItem onClick={() => handleRemoveAvatar(admin)} className="text-red-600 focus:text-red-600">
                                                                <UserX className="mr-2 h-4 w-4" />
                                                                Remove Avatar
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                    </>
                                                )}
                                                <DropdownMenuItem onClick={() => changeRole(admin, admin.role === "super_admin" ? "admin" : "super_admin")}>
                                                    {admin.role === "super_admin" ? (
                                                        <>
                                                            <Shield className="mr-2 h-4 w-4" />
                                                            Make Regular Admin
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ShieldCheck className="mr-2 h-4 w-4" />
                                                            Promote to Super Admin
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => toggleAdminStatus(admin)}
                                                    className={admin.is_active ? "text-red-600 focus:text-red-600" : "text-green-600 focus:text-green-600"}
                                                >
                                                    {admin.is_active ? (
                                                        <>
                                                            <UserX className="mr-2 h-4 w-4" />
                                                            Deactivate Admin
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UserCheck className="mr-2 h-4 w-4" />
                                                            Activate Admin
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <AddAdminModal
                open={addModalOpen}
                onOpenChange={setAddModalOpen}
                onSuccess={fetchAdmins}
            />

            {/* Avatar Editing Tools */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />

            <ImageCropper
                imageSrc={selectedFile}
                open={showCropper}
                onCancel={() => {
                    setShowCropper(false);
                    setSelectedFile(null);
                    setTargetAdmin(null);
                }}
                onCropComplete={handleCropComplete}
            />

            {/* Rename Admin Dialog */}
            <Dialog
                open={Boolean(renamingAdmin)}
                onOpenChange={(open) => !open && setRenamingAdmin(null)}
            >
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Change Admin Name</DialogTitle>
                        <DialogDescription>
                            Update the official name for this administrator account.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleRenameAdmin} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="admin-new-name">Updated Name</Label>
                            <Input
                                id="admin-new-name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Enter admin name"
                                autoFocus
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setRenamingAdmin(null)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isRenaming || !newName.trim()}>
                                {isRenaming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
