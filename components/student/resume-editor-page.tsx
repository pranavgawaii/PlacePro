"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { RESUME_TEMPLATES } from "@/lib/constants";
import { buildResumeHtml } from "@/lib/resume-templates";
import { createClient } from "@/lib/supabase/client";
import { Database, Json, ResumeData, ResumeTemplateType } from "@/types/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type ResumeRow = Database["public"]["Tables"]["resumes"]["Row"];

type ResumeEditorPageProps = {
  resumeId: string;
};

function emptyResumeData(): ResumeData {
  return {
    personal: {
      name: "",
      email: "",
      phone: "",
      linkedin: "",
      github: "",
      portfolio: ""
    },
    education: [],
    experience: [],
    projects: [],
    skills: {
      technical: [],
      soft: []
    },
    certifications: [],
    achievements: []
  };
}

function parseResumeData(raw: unknown): ResumeData {
  if (!raw || typeof raw !== "object") {
    return emptyResumeData();
  }

  const source = raw as Partial<ResumeData>;
  return {
    personal: {
      name: source.personal?.name ?? "",
      email: source.personal?.email ?? "",
      phone: source.personal?.phone ?? "",
      linkedin: source.personal?.linkedin ?? "",
      github: source.personal?.github ?? "",
      portfolio: source.personal?.portfolio ?? ""
    },
    education: Array.isArray(source.education)
      ? source.education.map((item) => ({
          degree: item.degree ?? "",
          college: item.college ?? "",
          year: item.year ?? "",
          cgpa: item.cgpa ?? ""
        }))
      : [],
    experience: Array.isArray(source.experience)
      ? source.experience.map((item) => ({
          title: item.title ?? "",
          company: item.company ?? "",
          duration: item.duration ?? "",
          description: item.description ?? ""
        }))
      : [],
    projects: Array.isArray(source.projects)
      ? source.projects.map((item) => ({
          name: item.name ?? "",
          tech: Array.isArray(item.tech) ? item.tech.filter((v): v is string => typeof v === "string") : [],
          description: item.description ?? "",
          link: item.link ?? "",
          github: item.github ?? ""
        }))
      : [],
    skills: {
      technical: Array.isArray(source.skills?.technical)
        ? source.skills.technical.filter((value): value is string => typeof value === "string")
        : [],
      soft: Array.isArray(source.skills?.soft)
        ? source.skills.soft.filter((value): value is string => typeof value === "string")
        : []
    },
    certifications: Array.isArray(source.certifications)
      ? source.certifications.map((item) => ({
          name: item.name ?? "",
          issuer: item.issuer ?? "",
          date: item.date ?? ""
        }))
      : [],
    achievements: Array.isArray(source.achievements)
      ? source.achievements.filter((value): value is string => typeof value === "string")
      : []
  };
}

async function openResumePdf(filePathOrUrl: string, supabase: ReturnType<typeof createClient>) {
  if (/^https?:\/\//i.test(filePathOrUrl)) {
    window.open(filePathOrUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const { data, error } = await supabase.storage.from("resumes").createSignedUrl(filePathOrUrl, 60 * 10);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Unable to open resume PDF");
  }

  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

function splitSkills(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function combineSkills(values: string[]) {
  return values.join(", ");
}

function splitAchievements(value: string) {
  return value
    .split("\n")
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

function combineAchievements(values: string[]) {
  return values.map((value) => `- ${value}`).join("\n");
}

export function ResumeEditorPage({ resumeId }: ResumeEditorPageProps) {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [resume, setResume] = useState<ResumeRow | null>(null);
  const [title, setTitle] = useState("Resume");
  const [template, setTemplate] = useState<ResumeTemplateType>("modern");
  const [data, setData] = useState<ResumeData>(emptyResumeData());
  const [techSkillsInput, setTechSkillsInput] = useState("");
  const [softSkillsInput, setSoftSkillsInput] = useState("");
  const [achievementsInput, setAchievementsInput] = useState("");

  useEffect(() => {
    const fetchResume = async () => {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error(userError?.message ?? "Unable to load user");
        setLoading(false);
        return;
      }

      const { data: resumeRow, error: resumeError } = await supabase
        .from("resumes")
        .select("*, students!inner(user_id)")
        .eq("id", resumeId)
        .single();

      if (resumeError || !resumeRow) {
        toast.error(resumeError?.message ?? "Resume not found");
        setLoading(false);
        return;
      }

      const owner = resumeRow.students as { user_id: string };
      if (owner.user_id !== user.id) {
        toast.error("You are not allowed to edit this resume");
        router.replace("/student/profile");
        return;
      }

      const parsed = parseResumeData(resumeRow.resume_data);
      setResume(resumeRow as ResumeRow);
      setTitle(resumeRow.title);
      setTemplate((resumeRow.template_type as ResumeTemplateType) ?? "modern");
      setData(parsed);
      setTechSkillsInput(combineSkills(parsed.skills.technical));
      setSoftSkillsInput(combineSkills(parsed.skills.soft));
      setAchievementsInput(combineAchievements(parsed.achievements));
      setLoading(false);
    };

    void fetchResume();
  }, [resumeId]);

  const previewHtml = useMemo(() => {
    const next = {
      ...data,
      skills: {
        technical: splitSkills(techSkillsInput),
        soft: splitSkills(softSkillsInput)
      },
      achievements: splitAchievements(achievementsInput)
    };
    return buildResumeHtml(next, template);
  }, [data, template, techSkillsInput, softSkillsInput, achievementsInput]);

  const saveDraft = async () => {
    if (!resume) {
      return;
    }

    setSaving(true);

    const payloadData: ResumeData = {
      ...data,
      skills: {
        technical: splitSkills(techSkillsInput),
        soft: splitSkills(softSkillsInput)
      },
      achievements: splitAchievements(achievementsInput)
    };

    const { data: updated, error } = await supabase
      .from("resumes")
      .update({
        title,
        template_type: template,
        resume_data: payloadData as unknown as Json
      })
      .eq("id", resume.id)
      .select("*")
      .single();

    if (error || !updated) {
      toast.error(error?.message ?? "Unable to save resume");
      setSaving(false);
      return;
    }

    setResume(updated);
    setData(payloadData);
    toast.success("Resume draft saved");
    setSaving(false);
  };

  const generatePdf = async () => {
    if (!resume) {
      return;
    }

    await saveDraft();
    setGenerating(true);

    const response = await fetch(`/api/resumes/${resume.id}/generate-pdf`, { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as { file_url?: string; error?: string };

    if (!response.ok) {
      toast.error(body.error ?? "Failed to generate PDF");
      setGenerating(false);
      return;
    }

    const { data: updated } = await supabase.from("resumes").select("*").eq("id", resume.id).single();
    if (updated) {
      setResume(updated);
    }

    toast.success("Resume PDF generated");
    setGenerating(false);
  };

  const setDefault = async () => {
    if (!resume) {
      return;
    }

    const { error } = await supabase.from("resumes").update({ is_default: true }).eq("id", resume.id);
    if (error) {
      toast.error(error.message);
      return;
    }

    setResume((prev) => (prev ? { ...prev, is_default: true } : prev));
    toast.success("Set as default resume");
  };

  const previewPdf = async () => {
    if (!resume?.file_url) {
      toast.error("Generate PDF first");
      return;
    }

    try {
      await openResumePdf(resume.file_url, supabase);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to preview PDF");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[42rem] w-full" />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Edit Resume</h1>
          <p className="text-sm text-muted-foreground">Build and tailor your resume for different companies.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/student/profile">Back to Profile</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
            <CardDescription>Preview updates instantly while editing.</CardDescription>
          </CardHeader>
          <CardContent>
            <iframe title="Resume preview" srcDoc={previewHtml} className="h-[70vh] w-full rounded border bg-white" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resume Form</CardTitle>
            <CardDescription>Fill each section to generate your final PDF.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[75vh] space-y-6 overflow-y-auto">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Template</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {RESUME_TEMPLATES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded border px-3 py-2 text-left text-sm ${
                      template === option.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => setTemplate(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">Personal Info</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Name"
                  value={data.personal.name}
                  onChange={(event) =>
                    setData((prev) => ({ ...prev, personal: { ...prev.personal, name: event.target.value } }))
                  }
                />
                <Input
                  placeholder="Email"
                  value={data.personal.email}
                  onChange={(event) =>
                    setData((prev) => ({ ...prev, personal: { ...prev.personal, email: event.target.value } }))
                  }
                />
                <Input
                  placeholder="Phone"
                  value={data.personal.phone ?? ""}
                  onChange={(event) =>
                    setData((prev) => ({ ...prev, personal: { ...prev.personal, phone: event.target.value } }))
                  }
                />
                <Input
                  placeholder="LinkedIn"
                  value={data.personal.linkedin ?? ""}
                  onChange={(event) =>
                    setData((prev) => ({ ...prev, personal: { ...prev.personal, linkedin: event.target.value } }))
                  }
                />
                <Input
                  placeholder="GitHub"
                  value={data.personal.github ?? ""}
                  onChange={(event) =>
                    setData((prev) => ({ ...prev, personal: { ...prev.personal, github: event.target.value } }))
                  }
                />
                <Input
                  placeholder="Portfolio"
                  value={data.personal.portfolio ?? ""}
                  onChange={(event) =>
                    setData((prev) => ({ ...prev, personal: { ...prev.personal, portfolio: event.target.value } }))
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Education</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setData((prev) => ({
                      ...prev,
                      education: [...prev.education, { degree: "", college: "", year: "", cgpa: "" }]
                    }))
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </div>
              {data.education.map((item, index) => (
                <div key={`edu-${index}`} className="grid gap-2 rounded border p-2 sm:grid-cols-2">
                  <Input
                    placeholder="Degree"
                    value={item.degree}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        education: prev.education.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, degree: event.target.value } : row
                        )
                      }))
                    }
                  />
                  <Input
                    placeholder="College"
                    value={item.college}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        education: prev.education.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, college: event.target.value } : row
                        )
                      }))
                    }
                  />
                  <Input
                    placeholder="Year"
                    value={item.year}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        education: prev.education.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, year: event.target.value } : row
                        )
                      }))
                    }
                  />
                  <Input
                    placeholder="CGPA"
                    value={item.cgpa ?? ""}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        education: prev.education.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, cgpa: event.target.value } : row
                        )
                      }))
                    }
                  />
                  <div className="sm:col-span-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        setData((prev) => ({ ...prev, education: prev.education.filter((_, rowIndex) => rowIndex !== index) }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Experience</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setData((prev) => ({
                      ...prev,
                      experience: [...prev.experience, { title: "", company: "", duration: "", description: "" }]
                    }))
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </div>
              {data.experience.map((item, index) => (
                <div key={`exp-${index}`} className="space-y-2 rounded border p-2">
                  <Input
                    placeholder="Title"
                    value={item.title}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        experience: prev.experience.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, title: event.target.value } : row
                        )
                      }))
                    }
                  />
                  <Input
                    placeholder="Company"
                    value={item.company}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        experience: prev.experience.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, company: event.target.value } : row
                        )
                      }))
                    }
                  />
                  <Input
                    placeholder="Duration"
                    value={item.duration}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        experience: prev.experience.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, duration: event.target.value } : row
                        )
                      }))
                    }
                  />
                  <Textarea
                    placeholder="Description"
                    value={item.description}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        experience: prev.experience.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, description: event.target.value } : row
                        )
                      }))
                    }
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      setData((prev) => ({
                        ...prev,
                        experience: prev.experience.filter((_, rowIndex) => rowIndex !== index)
                      }))
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Projects</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setData((prev) => ({
                      ...prev,
                      projects: [...prev.projects, { name: "", tech: [], description: "", link: "", github: "" }]
                    }))
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </div>
              {data.projects.map((item, index) => (
                <div key={`project-${index}`} className="space-y-2 rounded border p-2">
                  <Input
                    placeholder="Project name"
                    value={item.name}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        projects: prev.projects.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, name: event.target.value } : row
                        )
                      }))
                    }
                  />
                  <Input
                    placeholder="Tech stack (comma separated)"
                    value={item.tech.join(", ")}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        projects: prev.projects.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, tech: splitSkills(event.target.value) } : row
                        )
                      }))
                    }
                  />
                  <Textarea
                    placeholder="Description"
                    value={item.description}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        projects: prev.projects.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, description: event.target.value } : row
                        )
                      }))
                    }
                  />
                  <Input
                    placeholder="Live link"
                    value={item.link ?? ""}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        projects: prev.projects.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, link: event.target.value } : row
                        )
                      }))
                    }
                  />
                  <Input
                    placeholder="GitHub link"
                    value={item.github ?? ""}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        projects: prev.projects.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, github: event.target.value } : row
                        )
                      }))
                    }
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      setData((prev) => ({
                        ...prev,
                        projects: prev.projects.filter((_, rowIndex) => rowIndex !== index)
                      }))
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Skills</h3>
              <Input
                placeholder="Technical skills (comma separated)"
                value={techSkillsInput}
                onChange={(event) => setTechSkillsInput(event.target.value)}
              />
              <Input
                placeholder="Soft skills (comma separated)"
                value={softSkillsInput}
                onChange={(event) => setSoftSkillsInput(event.target.value)}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Certifications</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setData((prev) => ({
                      ...prev,
                      certifications: [...prev.certifications, { name: "", issuer: "", date: "" }]
                    }))
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </div>
              {data.certifications.map((item, index) => (
                <div key={`cert-${index}`} className="grid gap-2 rounded border p-2 sm:grid-cols-3">
                  <Input
                    placeholder="Name"
                    value={item.name}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        certifications: prev.certifications.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, name: event.target.value } : row
                        )
                      }))
                    }
                  />
                  <Input
                    placeholder="Issuer"
                    value={item.issuer}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        certifications: prev.certifications.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, issuer: event.target.value } : row
                        )
                      }))
                    }
                  />
                  <Input
                    placeholder="Date"
                    value={item.date}
                    onChange={(event) =>
                      setData((prev) => ({
                        ...prev,
                        certifications: prev.certifications.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, date: event.target.value } : row
                        )
                      }))
                    }
                  />
                  <div className="sm:col-span-3">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          certifications: prev.certifications.filter((_, rowIndex) => rowIndex !== index)
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Achievements</h3>
              <Textarea
                rows={5}
                placeholder="- Achievement one"
                value={achievementsInput}
                onChange={(event) => setAchievementsInput(event.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              {resume?.is_default ? <Badge variant="success">Default Resume</Badge> : null}
              <Button onClick={() => void saveDraft()} disabled={saving}>
                <Save className="mr-1 h-4 w-4" />
                {saving ? "Saving..." : "Save Draft"}
              </Button>
              <Button variant="outline" onClick={() => void generatePdf()} disabled={generating}>
                <Sparkles className="mr-1 h-4 w-4" />
                {generating ? "Generating..." : "Generate PDF"}
              </Button>
              <Button variant="outline" onClick={() => void previewPdf()}>
                Preview PDF
              </Button>
              {!resume?.is_default ? (
                <Button variant="outline" onClick={() => void setDefault()}>
                  Set as Default
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
