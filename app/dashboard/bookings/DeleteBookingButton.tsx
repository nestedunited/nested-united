"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePermission } from "@/lib/hooks/usePermission";

interface Booking {
  id: string;
  type?: "manual" | "ical";
  guest_name: string;
}

interface DeleteBookingButtonProps {
  booking: Booking;
}

export function DeleteBookingButton({ booking }: DeleteBookingButtonProps) {
  const canEdit = usePermission("edit");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const isIcal = booking.type === "ical";
  const bookingId = isIcal ? booking.id.replace("reservation-", "") : booking.id.replace("booking-", "");

  if (canEdit === null || !canEdit) {
    return null;
  }

  const handleDelete = async () => {
    if (!confirm(`هل أنت متأكد من حذف حجز "${booking.guest_name}"؟`)) {
      return;
    }

    setLoading(true);
    try {
      const endpoint = isIcal 
        ? `/api/reservations/${bookingId}`
        : `/api/bookings/${bookingId}`;

      const response = await fetch(endpoint, {
        method: "DELETE",
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage = result.error || "فشل حذف الحجز";
        console.error("Delete error:", errorMessage, result);
        throw new Error(errorMessage);
      }

      router.refresh();
    } catch (error: any) {
      console.error("Error deleting booking:", error);
      alert(error.message || "حدث خطأ أثناء حذف الحجز");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
      title="حذف الحجز"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Trash2 className="w-4 h-4" />
      )}
    </button>
  );
}

