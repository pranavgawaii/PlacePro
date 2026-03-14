export type ReminderRecipientMode = "selected" | "upload" | "all";
export type ReminderChannel = "email" | "whatsapp";

export interface UploadedReminderRecipient {
  enrollment_no: string;
  email: string | null;
  phone: string | null;
  rowNumber?: number;
}

export interface ReminderSendRequest {
  recipientMode: ReminderRecipientMode;
  studentIds?: string[];
  uploadedRecipients?: UploadedReminderRecipient[];
  channels: ReminderChannel[];
  emailSubject?: string;
  emailTitle?: string;
  messageEmail?: string;
  messageWhatsApp?: string;
}

export interface ReminderChannelSummary {
  sent: number;
  failed: number;
}

export interface ReminderSendSummary {
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  channelSummary: Record<ReminderChannel, ReminderChannelSummary>;
}

export interface ReminderSendResponse {
  success: boolean;
  summary?: ReminderSendSummary;
  error?: string;
}

export interface ReminderChannelAvailability {
  emailEnabled: boolean;
  whatsappEnabled: boolean;
}
