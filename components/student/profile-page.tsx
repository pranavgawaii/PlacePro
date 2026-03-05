"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  User, GraduationCap, FileCheck, Briefcase, Camera,
  FileText, CheckCircle2, AlertCircle, Download,
  ChevronRight, Mail, Phone, Linkedin, Globe, MapPin,
  Calendar, ShieldCheck, Upload
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type StudentRow = Database["public"]["Tables"]["students"]["Row"] & { avatar_url?: string | null };
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type DocType = Database["public"]["Tables"]["documents"]["Row"]["doc_type"];

const SEMESTER_DOCS = [
  { type: "tenth", label: "10th Marksheet", required: true },
  { type: "twelfth", label: "12th Marksheet", required: true },
  { type: "sem1", label: "Semester 1", required: true },
  { type: "sem2", label: "Semester 2", required: true },
  { type: "sem3", label: "Semester 3", required: true },
  { type: "sem4", label: "Semester 4", required: true },
  { type: "sem5", label: "Semester 5", required: true },
  { type: "sem6", label: "Semester 6", required: true },
  { type: "sem7", label: "Semester 7", required: false },
  { type: "sem8", label: "Semester 8", required: false },
];

export function StudentProfilePage() {
  const supabase = createClient();
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: studentData, error } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      setStudent(studentData);

      const { data: docs } = await supabase.from("documents").select("*").eq("student_id", studentData.id);
      setDocuments(docs || []);
    } catch (error) {
      console.error("Error fetching profile:", error);
      // toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (field: keyof StudentRow, value: any) => {
    if (!student) return;
    try {
      const updatedStudent = { ...student, [field]: value };

      // Auto-calculate Overall CGPA if sem-wise values change
      if (field.startsWith('cgpa_sem')) {
        const sems = [1, 2, 3, 4, 5, 6, 7, 8].map(s => updatedStudent[`cgpa_sem${s}` as keyof StudentRow]);
        const validSems = sems.filter((s): s is number => typeof s === 'number' && s > 0);
        if (validSems.length > 0) {
          const avg = validSems.reduce((a, b) => a + b, 0) / validSems.length;
          updatedStudent.overall_cgpa = parseFloat(avg.toFixed(2));
        }
      }

      // Determine profile completeness
      const hasBasicInfo = !!(updatedStudent.name && updatedStudent.email && updatedStudent.prn && updatedStudent.branch);
      const hasAcademics = !!(updatedStudent.tenth_percentage && updatedStudent.twelfth_percentage && updatedStudent.overall_cgpa);
      const hasRequiredDocs = SEMESTER_DOCS.filter(d => d.required).every(d => documents.some(doc => doc.doc_type === d.type));

      updatedStudent.profile_complete = hasBasicInfo && hasAcademics && hasRequiredDocs;

      const { error } = await supabase
        .from("students")
        .update({
          [field]: value,
          overall_cgpa: updatedStudent.overall_cgpa,
          profile_complete: updatedStudent.profile_complete
        })
        .eq("id", student.id);

      if (error) throw error;
      setStudent(updatedStudent);
      toast.success("Saved");
    } catch (error) {
      toast.error("Failed to save");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    if (!e.target.files || !e.target.files[0] || !student) return;

    const file = e.target.files[0];
    setUploading(docType);

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${student.id}/${docType}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("documents").upsert({
        student_id: student.id,
        doc_type: docType as DocType,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        verified: false
      });

      if (dbError) throw dbError;

      // Update completion status after successful upload
      const { data: latestDocs } = await supabase.from("documents").select("doc_type").eq("student_id", student.id);
      const hasBasicInfo = !!(student.name && student.email && student.prn && student.branch);
      const hasAcademics = !!(student.tenth_percentage && student.twelfth_percentage && student.overall_cgpa);
      const hasRequiredDocs = SEMESTER_DOCS.filter(d => d.required).every(d => (latestDocs || []).some(doc => doc.doc_type === d.type));

      const isComplete = hasBasicInfo && hasAcademics && hasRequiredDocs;

      await supabase.from("students").update({
        profile_complete: isComplete,
        documents_uploaded: (latestDocs || []).length
      }).eq("id", student.id);

      toast.success("Uploaded successfully");
      fetchProfile();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Upload failed");
    } finally {
      setUploading(null);
    }
  };

  if (loading) return <div className="p-8 space-y-4 max-w-5xl mx-auto"><Skeleton className="h-48 w-full rounded-xl" /><Skeleton className="h-96 w-full rounded-xl" /></div>;
  if (!student) return <div className="p-8 text-center text-neutral-500">Student record not found. Please contact admin.</div>;

  const completedDocsCount = SEMESTER_DOCS.filter(d => documents.some(doc => doc.doc_type === d.type)).length;
  const progressPercentage = Math.round((completedDocsCount / SEMESTER_DOCS.length) * 100);

  return (
    <div className="min-h-screen bg-white pb-20 font-sans text-neutral-900">
      {/* Header / Banner */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">


            <div className="relative group mr-6">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-neutral-100 bg-neutral-50 shadow-sm relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={student.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${student.name}&radius=50`}
                  alt={student.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{student.name}</h1>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-500">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-neutral-900">Enrollment No.:</span> {student.prn}
                </div>
                <div className="w-px h-4 bg-neutral-200 hidden md:block"></div>
                <div className="flex items-center gap-2">
                  <span>{student.branch}</span>
                  <span className="text-neutral-300">•</span>
                  <span>Batch {student.batch_year}</span>
                </div>
                <div className="w-px h-4 bg-neutral-200 hidden md:block"></div>
                <div className="flex items-center gap-2">
                  <span>{student.email}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-6 w-full md:w-auto">
              <div className="flex flex-col items-end">
                <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Overall CGPA</div>
                <div className="text-4xl font-light tracking-tighter text-neutral-950">{student.overall_cgpa || "-"}</div>
              </div>
              <div className="w-px h-12 bg-neutral-100 hidden md:block"></div>
              <div className="flex flex-col items-end">
                <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Completion</div>
                <div className="text-4xl font-light tracking-tighter text-neutral-950">{progressPercentage}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">

        {/* Left Column: Personal & Links */}
        <div className="lg:col-span-4 space-y-8">
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-2">Contact</h3>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs text-neutral-500 font-medium">Mobile Number</Label>
                <Input
                  value={student.phone || ""}
                  onChange={(e) => updateProfile("phone", e.target.value)}
                  className="h-9 px-0 border-0 border-b border-neutral-200 rounded-none focus-visible:ring-0 focus-visible:border-black transition-colors"
                  placeholder="+91..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-neutral-500 font-medium">LinkedIn URL</Label>
                <Input
                  value={student.linkedin_url || ""}
                  onChange={(e) => updateProfile("linkedin_url", e.target.value)}
                  className="h-9 px-0 border-0 border-b border-neutral-200 rounded-none focus-visible:ring-0 focus-visible:border-black transition-colors"
                  placeholder="linkedin.com/in/..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-neutral-500 font-medium">Portfolio URL</Label>
                <Input
                  value={student.portfolio_url || ""}
                  onChange={(e) => updateProfile("portfolio_url", e.target.value)}
                  className="h-9 px-0 border-0 border-b border-neutral-200 rounded-none focus-visible:ring-0 focus-visible:border-black transition-colors"
                  placeholder="your-portfolio.com"
                />
              </div>
            </div>
          </div>

          <div className="bg-neutral-50 p-6 rounded-sm border border-neutral-100">
            <div className="mb-4">
              <h3 className="font-semibold text-neutral-900 mb-1">Resume</h3>
              <p className="text-neutral-500 text-xs leading-relaxed">Ensure this is your latest PDF resume.</p>
            </div>
            <Button variant="outline" className="w-full bg-white border-neutral-200 text-neutral-900 hover:bg-black hover:text-white font-medium text-xs h-9">
              Upload Resume
            </Button>
          </div>
        </div>

        {/* Right Column: Academic & Documents */}
        <div className="lg:col-span-8 space-y-12">

          {/* Academic Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
              <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider">
                Academic Performance
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <div key={sem} className="group relative">
                  <div className="absolute inset-0 border border-neutral-200 rounded-sm pointer-events-none group-hover:border-neutral-400 transition-colors"></div>
                  <div className="p-4 bg-white">
                    <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-2">
                      Sem {sem}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <Input
                        type="number"
                        // @ts-ignore
                        value={student[`cgpa_sem${sem}`] || ""}
                        // @ts-ignore
                        onChange={(e) => updateProfile(`cgpa_sem${sem}`, parseFloat(e.target.value))}
                        className="border-none p-0 h-auto text-2xl font-light tracking-tight text-neutral-900 placeholder:text-neutral-200 focus-visible:ring-0 w-full bg-transparent"
                        placeholder="-"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Documents Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
              <h2 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider">
                Essential Documents
              </h2>
              <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-widest">
                Required: 10th, 12th & Sem 1-6
              </span>
            </div>

            <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-sm bg-white">
              {SEMESTER_DOCS.map((doc, index) => {
                const uploadedDoc = documents.find(d => d.doc_type === doc.type);
                const isUploaded = !!uploadedDoc;
                const isVerified = uploadedDoc?.verified;

                return (
                  <div key={doc.type} className="flex items-center px-6 py-4 hover:bg-neutral-50 transition-colors group">
                    <div className="w-8 text-neutral-300 text-xs font-mono">
                      {(index + 1).toString().padStart(2, '0')}
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-3">
                        <span className={cn("text-sm font-medium", isUploaded ? "text-neutral-900" : "text-neutral-500")}>
                          {doc.label}
                        </span>
                        {doc.required && !isUploaded && (
                          <span className="text-[10px] uppercase tracking-wider font-bold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-sm">Required</span>
                        )}
                        {isVerified && (
                          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-neutral-900 border border-neutral-200 px-1.5 py-0.5 rounded-sm">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                      {isUploaded && (
                        <a
                          href={uploadedDoc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-neutral-500 hover:text-black underline underline-offset-4"
                        >
                          View
                        </a>
                      )}
                      <div className="relative">
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                          onChange={(e) => handleFileUpload(e, doc.type)}
                          disabled={!!uploading}
                        />
                        <Button size="sm" variant="outline" className="h-7 text-xs border-neutral-300 text-neutral-900 hover:bg-black hover:text-white transition-colors">
                          {uploading === doc.type ? "..." : isUploaded ? "Replace" : "Upload"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
