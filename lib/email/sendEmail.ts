import { formatReminderMessageHtml, stripReminderFormatting } from "@/lib/reminders/emailFormatting";

interface SendEmailParams {
  to: string;
  subject: string;
  title: string;
  message: string;
}

function buildEmailHtml({ subject, title, message }: Omit<SendEmailParams, "to">) {
  const messageHtml = formatReminderMessageHtml(message);

  return `
    <div style="margin:0;padding:24px 0;background:#ffffff;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:680px;margin:0 auto;padding:0 24px;">
        <div style="padding-bottom:18px;border-bottom:1px solid #e5e7eb;">
          <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;font-weight:700;">MIT-ADT Placement Portal</div>
          <div style="margin-top:10px;font-size:15px;line-height:1.7;color:#334155;">${subject}</div>
          <div style="margin-top:18px;font-size:30px;line-height:1.2;font-weight:700;color:#0f172a;">${title}</div>
        </div>
        <div style="padding:28px 0 18px;">
          ${messageHtml}
        </div>
        <div style="padding-top:20px;border-top:1px solid #e5e7eb;">
          <div style="font-size:14px;font-weight:600;color:#0f172a;">PlacePro</div>
          <div style="margin-top:6px;font-size:13px;line-height:1.7;color:#64748b;">Official communication from the MIT-ADT placement portal.</div>
        </div>
      </div>
    </div>
  `;
}

function buildEmailText({ subject, title, message }: Omit<SendEmailParams, "to">) {
  return [
    "MIT-ADT Placement Portal",
    "",
    subject,
    "",
    title,
    "",
    stripReminderFormatting(message),
    "",
    "PlacePro",
    "Official communication from the MIT-ADT placement portal."
  ].join("\n");
}

export async function sendEmail({ to, subject, title, message }: SendEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("Missing Resend reminder environment variables.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html: buildEmailHtml({ subject, title, message }),
      text: buildEmailText({ subject, title, message })
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend request failed: ${response.status} ${errorBody}`);
  }

  return response.json().catch(() => null);
}
