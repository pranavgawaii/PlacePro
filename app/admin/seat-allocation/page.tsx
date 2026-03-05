import type { Metadata } from "next";
import { SeatAllocationPage } from "@/components/admin/seat-allocation-page";

export const metadata: Metadata = {
  title: "Seat Allocation | PlacePro Admin",
  description: "Run and publish seat allocation sessions for labs and students."
};

export default function AdminSeatAllocationRoute() {
  return <SeatAllocationPage />;
}
