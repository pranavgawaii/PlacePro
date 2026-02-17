import type { Metadata } from "next";
import { AdminMessagesPage } from "@/components/admin/messages-page";

export const metadata: Metadata = {
  title: "Messages | PlacePro Admin",
  description: "Broadcast placement announcements and send student messages."
};

export default function AdminMessagesRoute() {
  return <AdminMessagesPage />;
}
