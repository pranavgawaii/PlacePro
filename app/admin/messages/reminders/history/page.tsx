import type { Metadata } from "next";
import { ReminderHistoryPage } from "@/components/admin/reminders/ReminderHistoryPage";

export const metadata: Metadata = {
  title: "Reminder History | PlacePro Admin",
  description: "Review reminder delivery history from the Broadcast section."
};

export default function AdminReminderHistoryRoute() {
  return <ReminderHistoryPage />;
}
