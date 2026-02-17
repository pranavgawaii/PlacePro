"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  FileDown,
  FileText,
  FileCheck,
  MoreHorizontal,
  Search,
  Upload,
  UserPlus,
  Camera,
  UserX
} from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";
import { ImageCropper } from "@/components/ui/image-cropper";
import { BRANCHES, DOC_TYPES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { downloadCsv } from "@/lib/utils";
import { Branch, Database, DocType } from "@/types/database.types";
import { AddStudentModal } from "@/components/admin/students/AddStudentModal";
import { BulkUploadModal } from "@/components/admin/students/BulkUploadModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type StudentRow = Database["public"]["Tables"]["students"]["Row"] & { avatar_url?: string | null };
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];

const PAGE_SIZE = 15;

function uniqueDocs(docs: DocumentRow[]) {
  const map = new Map<DocType, DocumentRow>();
  docs.forEach((doc) => {
    if (DOC_TYPES.includes(doc.doc_type as DocType)) {
      map.set(doc.doc_type, doc);
    }
  });
  return map;
}

export function StudentsTable() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);

  const [branchFilter, setBranchFilter] = useState<Branch | "all">("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Rename Management state
  const [renamingStudent, setRenamingStudent] = useState<StudentRow | null>(null);
  const [newName, setNewName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Avatar Management state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [targetStudent, setTargetStudent] = useState<StudentRow | null>(null);
  const studentFileInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [studentsRes, docsRes, appsRes, { data: { user } }] = await Promise.all([
      supabase.from("students").select("*").order("created_at", { ascending: false }),
      supabase.from("documents").select("*").order("uploaded_at", { ascending: false }),
      supabase.from("applications").select("*").order("applied_at", { ascending: false }),
      supabase.auth.getUser()
    ]);

    if (studentsRes.error || docsRes.error || appsRes.error) {
      toast.error("Failed to load student data");
      setLoading(false);
      return;
    }

    if (user) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsSuperAdmin(roleRow?.role === "super_admin");
    }

    setStudents(studentsRes.data);
    setDocuments(docsRes.data);
    setApplications(appsRes.data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    setPage(1);
  }, [search, branchFilter, batchFilter]);

  const details = useMemo(() => {
    const docsByStudent = new Map<string, DocumentRow[]>();
    const appsByStudent = new Map<string, ApplicationRow[]>();

    documents.forEach((doc) => {
      const current = docsByStudent.get(doc.student_id) ?? [];
      current.push(doc);
      docsByStudent.set(doc.student_id, current);
    });

    applications.forEach((application) => {
      const current = appsByStudent.get(application.student_id) ?? [];
      current.push(application);
      appsByStudent.set(application.student_id, current);
    });

    return students.map((student) => ({
      student,
      docs: docsByStudent.get(student.id) ?? [],
      apps: appsByStudent.get(student.id) ?? []
    }));
  }, [students, documents, applications]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return details.filter((row) => {
      const branchPass = branchFilter === "all" ? true : row.student.branch === branchFilter;
      const batchPass = batchFilter === "all" ? true : String(row.student.batch_year) === batchFilter;
      const searchable = `${row.student.name} ${row.student.prn ?? ""} ${row.student.email}`.toLowerCase();
      const searchPass = query ? searchable.includes(query) : true;

      return branchPass && batchPass && searchPass;
    });
  }, [details, search, branchFilter, batchFilter]);

  const availableBatches = useMemo(() => {
    const set = new Set<number>();
    students.forEach((student) => set.add(student.batch_year));
    return [...set].sort((a, b) => a - b);
  }, [students]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const selectedOnPage = useMemo(
    () => currentRows.length > 0 && currentRows.every((row) => selectedStudentIds.has(row.student.id)),
    [currentRows, selectedStudentIds]
  );

  const toggleStudentSelection = (studentId: string, checked: boolean) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(studentId);
      } else {
        next.delete(studentId);
      }
      return next;
    });
  };

  const toggleSelectCurrentPage = (checked: boolean) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      currentRows.forEach((row) => {
        if (checked) {
          next.add(row.student.id);
        } else {
          next.delete(row.student.id);
        }
      });
      return next;
    });
  };

  const exportStudents = () => {
    const selectedRows = details.filter((row) => selectedStudentIds.has(row.student.id));
    if (selectedRows.length === 0) {
      toast.error("Select students to export");
      return;
    }

    const header = [
      "Name",
      "Email",
      "PRN",
      "Branch",
      "Batch Year",
      "Phone",
      "10th Percentage",
      "12th Percentage",
      "Overall CGPA",
      "Documents Uploaded",
      "Profile Complete"
    ];

    const lines = [
      header,
      ...selectedRows.map((row) => [
        row.student.name,
        row.student.email,
        row.student.prn ?? "",
        row.student.branch ?? "",
        String(row.student.batch_year),
        row.student.phone ?? "",
        row.student.tenth_percentage?.toString() ?? "",
        row.student.twelfth_percentage?.toString() ?? "",
        row.student.overall_cgpa?.toString() ?? "",
        String(row.student.documents_uploaded),
        row.student.profile_complete ? "Yes" : "No"
      ])
    ];

    const csv = lines
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    downloadCsv("students-export.csv", csv);
    toast.success(`Exported ${selectedRows.length} students`);
  };

  const detailRow = useMemo(() => details.find((row) => row.student.id === detailStudentId) ?? null, [details, detailStudentId]);

  const handleImported = () => {
    setSelectedStudentIds(new Set());
    void fetchAll();
  };

  const handleUpdateAvatarClick = (student: StudentRow) => {
    setTargetStudent(student);
    studentFileInputRef.current?.click();
  };

  const handleStudentFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleStudentCropComplete = async (croppedBlob: Blob) => {
    if (!targetStudent) return;
    setShowCropper(false);
    const toastId = toast.loading(`Updating ${targetStudent.name}'s avatar...`);

    try {
      const fileName = `${targetStudent.user_id}/${Date.now()}.jpg`;

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

      const { error: updateError } = await supabase
        .from("students")
        .update({ avatar_url: newUrl })
        .eq("id", targetStudent.id);

      if (updateError) {
        console.error('Supabase database update error:', updateError);
        throw new Error(`Failed to update avatar URL in database: ${updateError.message}`);
      }

      toast.success("Avatar updated successfully", { id: toastId });
      void fetchAll();
    } catch (error: any) {
      console.error('Full upload error detail:', error);
      toast.error(`Error: ${error.message || "Upload failed. Check console for details."}`, { id: toastId });
    } finally {
      if (studentFileInputRef.current) studentFileInputRef.current.value = "";
      setSelectedFile(null);
      setTargetStudent(null);
    }
  };

  const handleRemoveStudentAvatar = async (student: StudentRow) => {
    if (!confirm(`Are you sure you want to remove ${student.name}'s avatar?`)) return;

    const { error } = await supabase
      .from("students")
      .update({ avatar_url: null } as any)
      .eq("id", student.id);

    if (error) {
      toast.error("Failed to remove avatar");
    } else {
      toast.success("Avatar removed");
      void fetchAll();
    }
  };

  const handleRenameStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingStudent || !newName.trim()) return;

    setIsRenaming(true);
    const { error } = await supabase
      .from("students")
      .update({ name: newName.trim() } as any)
      .eq("id", renamingStudent.id);

    if (error) {
      toast.error("Failed to update name");
    } else {
      toast.success("Name updated successfully");
      void fetchAll();
      setRenamingStudent(null);
    }
    setIsRenaming(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card-border flex flex-col items-start justify-between gap-4 rounded-lg bg-white p-4 md:flex-row md:items-center">
        <div className="flex w-full flex-1 items-center gap-2 md:w-auto">
          <div className="relative flex-1 md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              placeholder="Search students..."
              className="bg-neutral-50 pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="mx-2 hidden h-8 w-px bg-neutral-200 md:block" />
          <select
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value as Branch | "all")}
            aria-label="Filter by branch"
          >
            <option value="all">All Branches</option>
            {BRANCHES.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
            value={batchFilter}
            onChange={(event) => setBatchFilter(event.target.value)}
            aria-label="Filter by batch"
          >
            <option value="all">All Batches</option>
            {availableBatches.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
          <Button type="button" variant="outline" size="sm" onClick={() => setBulkModalOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Upload
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setAddModalOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Student
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportStudents} disabled={selectedStudentIds.size === 0}>
            <FileDown className="mr-2 h-4 w-4" />
            Export ({selectedStudentIds.size})
          </Button>
        </div>
      </div>

      <div className="card-border overflow-hidden rounded-lg bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-neutral-50">
              <TableRow>
                <TableHead className="w-[40px] pl-4">
                  <Checkbox checked={selectedOnPage} onCheckedChange={(checked) => toggleSelectCurrentPage(checked === true)} />
                </TableHead>
                <TableHead className="min-w-[200px]">Student</TableHead>
                <TableHead>Academic Info</TableHead>
                <TableHead>Performance</TableHead>
                <TableHead>Readiness</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentRows.length > 0 ? (
                currentRows.map((row) => {
                  const docsMap = uniqueDocs(row.docs);
                  const requiredDocsCount = DOC_TYPES.filter((docType) => docsMap.has(docType)).length;
                  const isPlaced = row.apps.some((application) => application.status === "selected");
                  const activeApps = row.apps.filter((application) =>
                    ["applied", "shortlisted", "interview"].includes(application.status)
                  ).length;

                  return (
                    <TableRow key={row.student.id} className="group hover:bg-neutral-50/50">
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={selectedStudentIds.has(row.student.id)}
                          onCheckedChange={(checked) => toggleStudentSelection(row.student.id, checked === true)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
                            {row.student.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={row.student.avatar_url}
                                alt={row.student.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-neutral-600">
                                {row.student.name?.[0]}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-semibold">{row.student.name}</div>
                            <div className="text-xs text-neutral-500">{row.student.email}</div>
                            <div className="mt-0.5 font-mono text-[10px] text-neutral-400">{row.student.prn || "No PRN"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{row.student.branch || "-"}</span>
                          <span className="text-xs text-neutral-500">Batch {row.student.batch_year}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">
                            {row.student.overall_cgpa?.toFixed(2) || "-"}{" "}
                            <span className="text-xs font-normal text-neutral-400">CGPA</span>
                          </span>
                          <div className="flex gap-1 text-[10px] text-neutral-500">
                            <span>10th: {row.student.tenth_percentage ?? "-"}%</span>
                            <span>•</span>
                            <span>12th: {row.student.twelfth_percentage ?? "-"}%</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <div
                            className={`flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium ${row.student.profile_complete
                              ? "border-green-100 bg-green-50 text-green-700"
                              : "border-neutral-200 bg-neutral-50 text-neutral-500"
                              }`}
                          >
                            {row.student.profile_complete ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <AlertCircle className="h-3 w-3" />
                            )}
                            Profile
                          </div>
                          <div
                            className={`flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium ${row.student.profile_complete
                              ? "border-green-100 bg-green-50 text-green-700"
                              : "border-amber-100 bg-amber-50 text-amber-700"
                              }`}
                          >
                            <FileCheck className="h-3 w-3" />
                            {row.student.profile_complete ? "Verified" : "Pending Docs"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isPlaced ? (
                          <Badge variant="success" className="rounded-full">
                            Placed
                          </Badge>
                        ) : activeApps > 0 ? (
                          <Badge variant="secondary" className="rounded-full">
                            {activeApps} Active
                          </Badge>
                        ) : (
                          <span className="text-xs text-neutral-400">No Activity</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">More actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailStudentId(row.student.id)}>View</DropdownMenuItem>
                            {isSuperAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleUpdateAvatarClick(row.student)}>
                                  <Camera className="mr-2 h-4 w-4" />
                                  Upload New Pic
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setRenamingStudent(row.student);
                                  setNewName(row.student.name);
                                }}>
                                  <AlertCircle className="mr-2 h-4 w-4" />
                                  Change Name
                                </DropdownMenuItem>
                                {row.student.avatar_url && (
                                  <DropdownMenuItem onClick={() => handleRemoveStudentAvatar(row.student)} className="text-red-600 focus:text-red-600">
                                    <UserX className="mr-2 h-4 w-4" />
                                    Remove Avatar
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-neutral-500">
                    No students found matching your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 p-4">
          <span className="text-xs text-neutral-500">
            Showing {currentRows.length} of {filtered.length} students
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => value - 1)} disabled={page <= 1}>
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((value) => value + 1)}
              disabled={page >= pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(detailStudentId)} onOpenChange={(nextOpen) => !nextOpen && setDetailStudentId(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
            <DialogDescription>Detailed view for {detailRow?.student.name}</DialogDescription>
          </DialogHeader>
          <div className="rounded border border-neutral-200 bg-neutral-50 p-4 text-center text-sm text-neutral-500">
            Full student profile view (documents, resumes, applications) stays available in this panel.
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Student Dialog */}
      <Dialog
        open={Boolean(renamingStudent)}
        onOpenChange={(open) => !open && setRenamingStudent(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Name</DialogTitle>
            <DialogDescription>
              Update the official name for this student record.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameStudent} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Updated Name</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter new name"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenamingStudent(null)}
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

      <BulkUploadModal open={bulkModalOpen} onOpenChange={setBulkModalOpen} onImported={handleImported} />
      <AddStudentModal open={addModalOpen} onOpenChange={setAddModalOpen} onImported={handleImported} />

      {/* Avatar Editing Tools */}
      <input
        type="file"
        ref={studentFileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleStudentFileChange}
      />

      <ImageCropper
        imageSrc={selectedFile}
        open={showCropper}
        onCancel={() => {
          setShowCropper(false);
          setSelectedFile(null);
          setTargetStudent(null);
        }}
        onCropComplete={handleStudentCropComplete}
      />
    </div>
  );
}
