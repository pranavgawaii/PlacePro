import { ResumeData, ResumeTemplateType } from "@/types/database.types";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function section(title: string, content: string): string {
  return `<section style="margin-bottom:16px;"><h3 style="margin:0 0 8px 0;font-size:16px;color:#1e293b;">${escapeHtml(title)}</h3>${content}</section>`;
}

function list(items: string[]): string {
  return `<ul style="margin:0;padding-left:18px;">${items.map((item) => `<li style=\"margin-bottom:4px;\">${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function buildResumeHtml(data: ResumeData, template: ResumeTemplateType): string {
  const baseStyle = `
    body { font-family: 'Arial', sans-serif; margin:0; padding:0; color:#0f172a; }
    .page { padding: 28px; }
    .header { margin-bottom: 20px; }
    .name { font-size: 28px; font-weight: 700; margin: 0; }
    .meta { color: #334155; font-size: 12px; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
    .pill { display:inline-block; padding:4px 8px; border-radius:999px; background:#eff6ff; color:#1d4ed8; margin:2px; font-size:11px; }
  `;

  const accent =
    template === "creative"
      ? "#7c3aed"
      : template === "minimalist"
        ? "#0f172a"
        : template === "classic"
          ? "#111827"
          : "#2563eb";

  const educationContent = data.education
    .map(
      (item) =>
        `<div><strong>${escapeHtml(item.degree)}</strong> - ${escapeHtml(item.college)}<br/><span style="font-size:12px;color:#475569;">${escapeHtml(item.year)}${item.cgpa ? ` | CGPA ${escapeHtml(item.cgpa)}` : ""}</span></div>`
    )
    .join("");

  const experienceContent = data.experience.length
    ? data.experience
        .map(
          (item) =>
            `<div><strong>${escapeHtml(item.title)}</strong> - ${escapeHtml(item.company)}<br/><span style="font-size:12px;color:#475569;">${escapeHtml(item.duration)}</span><p style="margin:6px 0 0 0;white-space:pre-wrap;">${escapeHtml(item.description)}</p></div>`
        )
        .join("")
    : "<p style=\"margin:0;color:#64748b;\">No experience added</p>";

  const projectContent = data.projects
    .map(
      (item) =>
        `<div><strong>${escapeHtml(item.name)}</strong>${item.link ? ` - <a href=\"${escapeHtml(item.link)}\">Link</a>` : ""}<p style=\"margin:6px 0 4px 0;\">${escapeHtml(item.description)}</p><p style=\"margin:0;font-size:12px;color:#475569;\">Tech: ${escapeHtml(item.tech.join(", "))}</p></div>`
    )
    .join("");

  const skills = `${data.skills.technical
    .map((item) => `<span class=\"pill\">${escapeHtml(item)}</span>`)
    .join("")} ${data.skills.soft.map((item) => `<span class=\"pill\" style=\"background:#f0fdf4;color:#166534;\">${escapeHtml(item)}</span>`).join("")}`;

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        ${baseStyle}
        h3 { border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; color: ${accent}; }
      </style>
    </head>
    <body>
      <div class="page">
        <header class="header">
          <h1 class="name">${escapeHtml(data.personal.name)}</h1>
          <p class="meta">
            ${escapeHtml(data.personal.email)}${data.personal.phone ? ` | ${escapeHtml(data.personal.phone)}` : ""}
            ${data.personal.linkedin ? ` | ${escapeHtml(data.personal.linkedin)}` : ""}
            ${data.personal.github ? ` | ${escapeHtml(data.personal.github)}` : ""}
            ${data.personal.portfolio ? ` | ${escapeHtml(data.personal.portfolio)}` : ""}
          </p>
        </header>

        <div class="grid">
          ${section("Education", educationContent)}
          ${section("Experience", experienceContent)}
          ${section("Projects", projectContent)}
          ${section("Skills", `<div>${skills}</div>`)}
          ${section(
            "Certifications",
            data.certifications.length
              ? list(data.certifications.map((item) => `${item.name} - ${item.issuer} (${item.date})`))
              : "<p style=\"margin:0;color:#64748b;\">No certifications added</p>"
          )}
          ${section(
            "Achievements",
            data.achievements.length ? list(data.achievements) : "<p style=\"margin:0;color:#64748b;\">No achievements added</p>"
          )}
        </div>
      </div>
    </body>
  </html>`;
}
