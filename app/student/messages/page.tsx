import type { Metadata } from "next";
import { StudentMessagesPage } from "@/components/student/messages-page";

export const metadata: Metadata = {
  title: "Messages | PlacePro Student",
  description: "View updates and announcements from the placement cell."
};

export default function MessagesPage() {
  return <StudentMessagesPage />;
}
