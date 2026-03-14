import type { Metadata } from "next";
import { SendReminderPage } from "@/components/admin/reminders/SendReminderPage";

export const metadata: Metadata = {
  title: "Send Reminder | PlacePro Admin",
  description: "Send structured reminder emails and WhatsApp messages from the Broadcast section."
};

export default function AdminReminderComposerRoute() {
  return (
    <SendReminderPage
      emailEnabled={Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_EMAIL_FROM)}
      whatsappEnabled={Boolean(
        process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM
      )}
      senderEmail={process.env.REMINDER_EMAIL_FROM ?? "mitadt@contact.placepro.in"}
    />
  );
}
