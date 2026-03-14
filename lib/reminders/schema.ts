import { z } from "zod";

const reminderChannelSchema = z.enum(["email", "whatsapp"]);
const uploadedRecipientSchema = z.object({
  enrollment_no: z.string().trim().min(1, "Enrollment No is required"),
  email: z.string().trim().email("Invalid email").nullable().optional(),
  phone: z.string().trim().nullable().optional()
});

export const reminderSendRequestSchema = z
  .object({
    recipientMode: z.enum(["selected", "upload", "all"]),
    studentIds: z.array(z.string().uuid()).optional(),
    uploadedRecipients: z.array(uploadedRecipientSchema).optional(),
    channels: z.array(reminderChannelSchema).min(1, "Select at least one channel"),
    emailSubject: z.string().trim().optional(),
    emailTitle: z.string().trim().optional(),
    messageEmail: z.string().trim().optional(),
    messageWhatsApp: z.string().trim().optional()
  })
  .superRefine((value, ctx) => {
    if (value.recipientMode === "selected" && (!value.studentIds || value.studentIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentIds"],
        message: "Select at least one student."
      });
    }

    if (value.recipientMode === "upload" && (!value.uploadedRecipients || value.uploadedRecipients.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["uploadedRecipients"],
        message: "Upload at least one Excel row."
      });
    }

    if (value.channels.includes("email") && !value.messageEmail?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["messageEmail"],
        message: "Email message is required."
      });
    }

    if (value.channels.includes("email") && !value.emailSubject?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["emailSubject"],
        message: "Email subject is required."
      });
    }

    if (value.channels.includes("email") && !value.emailTitle?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["emailTitle"],
        message: "Email title is required."
      });
    }

    if (value.channels.includes("whatsapp") && !value.messageWhatsApp?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["messageWhatsApp"],
        message: "WhatsApp message is required."
      });
    }
  });
