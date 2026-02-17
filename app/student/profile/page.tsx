import type { Metadata } from "next";
import { StudentProfilePage } from "@/components/student/profile-page";

export const metadata: Metadata = {
  title: "Profile | PlacePro Student",
  description: "Complete your profile and upload academic documents for placement eligibility."
};

export default function ProfilePage() {
  return <StudentProfilePage />;
}
