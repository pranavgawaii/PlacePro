import { formatWhatsAppPhone } from "@/lib/reminders/utils";

interface SendWhatsAppParams {
  phone: string;
  message: string;
}

export async function sendWhatsApp({ phone, message }: SendWhatsAppParams) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    throw new Error("Missing Twilio WhatsApp environment variables.");
  }

  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      From: formatWhatsAppPhone(from),
      To: formatWhatsAppPhone(phone),
      Body: message
    }).toString()
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Twilio request failed: ${response.status} ${errorBody}`);
  }

  return response.json().catch(() => null);
}
