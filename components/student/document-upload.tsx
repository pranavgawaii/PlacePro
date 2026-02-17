"use client";

import { ChangeEvent, DragEvent, useMemo, useState } from "react";
import { CheckCircle2, FileUp, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { DOC_TYPE_LABELS, DOC_TYPES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { Database, DocType } from "@/types/database.types";
import { formatBytes } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

interface DocumentUploadProps {
  studentId: string;
  documentsByType: Partial<Record<DocType, DocumentRow>>;
  onDocumentUpsert: (docType: DocType, row: DocumentRow) => void;
  onDocumentDelete: (docType: DocType) => void;
}

const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

async function resolveFileUrl(filePathOrUrl: string, supabase: ReturnType<typeof createClient>) {
  if (/^https?:\/\//i.test(filePathOrUrl)) {
    return filePathOrUrl;
  }

  const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePathOrUrl, 60 * 10);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Unable to create preview link");
  }

  return data.signedUrl;
}

export function DocumentUpload({ studentId, documentsByType, onDocumentUpsert, onDocumentDelete }: DocumentUploadProps) {
  const supabase = createClient();
  const [uploadProgress, setUploadProgress] = useState<Partial<Record<DocType, number>>>({});
  const [uploading, setUploading] = useState<Partial<Record<DocType, boolean>>>({});
  const [deleting, setDeleting] = useState<Partial<Record<DocType, boolean>>>({});

  const completedCount = useMemo(
    () => DOC_TYPES.filter((docType) => Boolean(documentsByType[docType])).length,
    [documentsByType]
  );

  const uploadFile = async (docType: DocType, file: File) => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error("Only PDF/JPG/PNG files are allowed.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be less than 5MB.");
      return;
    }

    setUploading((prev) => ({ ...prev, [docType]: true }));
    setUploadProgress((prev) => ({ ...prev, [docType]: 10 }));

    const progressInterval = window.setInterval(() => {
      setUploadProgress((prev) => {
        const current = prev[docType] ?? 0;
        if (current >= 90) {
          return prev;
        }
        return { ...prev, [docType]: current + 5 };
      });
    }, 120);

    const safeFileName = sanitizeFileName(file.name);
    const filePath = `${studentId}/${docType}_${Date.now()}_${safeFileName}`;

    const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type
    });

    if (uploadError) {
      window.clearInterval(progressInterval);
      setUploading((prev) => ({ ...prev, [docType]: false }));
      setUploadProgress((prev) => ({ ...prev, [docType]: 0 }));
      toast.error(uploadError.message);
      return;
    }

    const { data: row, error: insertError } = await supabase
      .from("documents")
      .upsert(
        {
          student_id: studentId,
          doc_type: docType,
          file_url: filePath,
          file_name: file.name,
          file_size: file.size,
          verified: false
        },
        { onConflict: "student_id,doc_type" }
      )
      .select("*")
      .single();

    window.clearInterval(progressInterval);

    if (insertError) {
      setUploading((prev) => ({ ...prev, [docType]: false }));
      setUploadProgress((prev) => ({ ...prev, [docType]: 0 }));
      toast.error(insertError.message);
      return;
    }

    setUploadProgress((prev) => ({ ...prev, [docType]: 100 }));
    setUploading((prev) => ({ ...prev, [docType]: false }));
    onDocumentUpsert(docType, row);
    toast.success("Document uploaded ✓");
  };

  const onFileInput = (docType: DocType) => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await uploadFile(docType, file);
    event.target.value = "";
  };

  const onDropFile = (docType: DocType) => async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    await uploadFile(docType, file);
  };

  const onPreview = async (doc: DocumentRow) => {
    try {
      const url = await resolveFileUrl(doc.file_url, supabase);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open document");
    }
  };

  const onDelete = async (docType: DocType) => {
    const row = documentsByType[docType];
    if (!row) {
      return;
    }

    setDeleting((prev) => ({ ...prev, [docType]: true }));

    const storagePath = /^https?:\/\//i.test(row.file_url) ? null : row.file_url;
    if (storagePath) {
      await supabase.storage.from("documents").remove([storagePath]);
    }

    const { error } = await supabase.from("documents").delete().eq("id", row.id);

    if (error) {
      toast.error(error.message);
      setDeleting((prev) => ({ ...prev, [docType]: false }));
      return;
    }

    onDocumentDelete(docType);
    toast.success("Document deleted");
    setDeleting((prev) => ({ ...prev, [docType]: false }));
  };

  return (
    <Card id="documents">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Upload Required Documents</span>
          <Badge variant="secondary">{completedCount}/10 uploaded</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {DOC_TYPES.map((docType) => {
          const row = documentsByType[docType];
          const progress = uploadProgress[docType] ?? 0;
          const isUploading = uploading[docType] ?? false;
          const isDeleting = deleting[docType] ?? false;

          return (
            <div key={docType} className="rounded-lg border border-dashed p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{DOC_TYPE_LABELS[docType]}</p>
                  {row ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{row.file_name ?? "Uploaded file"}</span>
                      {row.file_size ? <span>{formatBytes(row.file_size)}</span> : null}
                      {row.verified ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Verified ✓
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending review</Badge>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">Upload max 5MB (PDF/JPG/PNG)</p>
                  )}
                </div>

                <div
                  className="rounded-lg bg-muted/60 p-3"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={onDropFile(docType)}
                >
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium" htmlFor={`upload-${docType}`}>
                    <UploadCloud className="h-4 w-4" />
                    {isUploading ? "Uploading..." : row ? "Replace File" : "Browse / Drag-drop"}
                  </label>
                  <input
                    id={`upload-${docType}`}
                    type="file"
                    className="hidden"
                    accept="application/pdf,image/jpeg,image/jpg,image/png"
                    onChange={onFileInput(docType)}
                    aria-label={`Upload ${DOC_TYPE_LABELS[docType]}`}
                  />
                </div>
              </div>

              {row ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" type="button" onClick={() => void onPreview(row)}>
                    Preview
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    type="button"
                    onClick={() => void onDelete(docType)}
                    disabled={isDeleting}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              ) : null}

              {isUploading ? (
                <div className="mt-3 space-y-1">
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground">{Math.min(progress, 100)}% uploaded</p>
                </div>
              ) : null}

              {!row && !isUploading ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <FileUp className="h-4 w-4" />
                  <span>Drop file here or use browse.</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
