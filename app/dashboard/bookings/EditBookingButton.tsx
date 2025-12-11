"use client";

import { Edit } from "lucide-react";
import Link from "next/link";

interface Booking {
  id: string;
  type?: "manual" | "ical";
  guest_name: string;
  checkin_date: string;
  checkout_date: string;
  unit?: { id: string } | null;
  platform_account_id?: string | null;
  platform?: string | null;
}

interface EditBookingButtonProps {
  booking: Booking;
}

export function EditBookingButton({ booking }: EditBookingButtonProps) {
  const isIcal = booking.type === "ical";
  const bookingId = isIcal ? booking.id.replace("reservation-", "") : booking.id.replace("booking-", "");

  // For iCal reservations, we can't edit them directly - they need to be converted to bookings first
  // For now, we'll show a message or redirect to a convert page
  // But actually, we can allow editing iCal reservations by converting them to bookings on the fly
  if (isIcal) {
    return (
      <Link
        href={`/dashboard/bookings/convert/${bookingId}`}
        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
        title="تحويل وتعديل الحجز من iCal"
      >
        <Edit className="w-4 h-4" />
      </Link>
    );
  }

  return (
    <Link
      href={`/dashboard/bookings/edit/${bookingId}`}
      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
      title="تعديل الحجز"
    >
      <Edit className="w-4 h-4" />
    </Link>
  );
}

