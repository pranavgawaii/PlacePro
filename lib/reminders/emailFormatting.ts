function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInlineTokens(value: string) {
  return value
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<span style=\"text-decoration:underline;\">$1</span>")
    .replace(/==(.+?)==/g, "<mark style=\"background:#fef3c7;color:#7c2d12;padding:0 2px;\">$1</mark>");
}

export function formatReminderMessageHtml(message: string): string {
  const normalized = message.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }

  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const isBulletBlock = lines.every((line) => line.startsWith("- ") || line.startsWith("• "));

      if (isBulletBlock) {
        const items = lines
          .map((line) => line.replace(/^[-•]\s*/, ""))
          .map((line) => `<li style="margin:0 0 8px;">${formatInlineTokens(escapeHtml(line))}</li>`)
          .join("");

        return `<ul style="margin:0 0 18px 18px;padding:0;color:#334155;font-size:15px;line-height:1.8;">${items}</ul>`;
      }

      return `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.8;">${formatInlineTokens(escapeHtml(block).replace(/\n/g, "<br />"))}</p>`;
    })
    .join("");
}

export function stripReminderFormatting(message: string): string {
  return message
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/==(.+?)==/g, "$1");
}
