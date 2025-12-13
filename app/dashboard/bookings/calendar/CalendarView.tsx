"use client";

import { useState } from "react";
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon } from "lucide-react";
import { useRouter } from "next/navigation";

interface Booking {
  id: string;
  type: "manual" | "ical";
  guest_name: string;
  checkin_date: string;
  checkout_date: string;
  unit?: {
    unit_name: string;
    unit_code?: string | null;
  } | null;
  platform_account?: {
    account_name: string;
  } | null;
}

interface CalendarViewProps {
  year: number;
  month: number;
  initialBookings: Booking[];
}

export function CalendarView({ year: initialYear, month: initialMonth, initialBookings }: CalendarViewProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date(initialYear, initialMonth, 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [bookings] = useState<Booking[]>(initialBookings);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  // Adjust for RTL (Arabic week starts on Saturday = 6)
  const adjustedStartingDay = (startingDayOfWeek + 1) % 7;

  const monthNames = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];

  const weekDays = ["سبت", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];

  function getBookingsForDate(date: number): Booking[] {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
    return bookings.filter(
      (b) => b.checkin_date <= dateStr && b.checkout_date >= dateStr
    );
  }

  function goToPreviousMonth() {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
    router.push(`/dashboard/bookings/calendar?year=${newDate.getFullYear()}&month=${newDate.getMonth() + 1}`);
  }

  function goToNextMonth() {
    const newDate = new Date(year, month + 1, 1);
    setCurrentDate(newDate);
    router.push(`/dashboard/bookings/calendar?year=${newDate.getFullYear()}&month=${newDate.getMonth() + 1}`);
  }

  function goToToday() {
    const today = new Date();
    setCurrentDate(today);
    router.push(`/dashboard/bookings/calendar?year=${today.getFullYear()}&month=${today.getMonth() + 1}`);
  }

  const selectedDateBookings = selectedDate
    ? getBookingsForDate(parseInt(selectedDate))
    : [];

  return (
    <>
      {/* Calendar Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-semibold text-gray-900 min-w-[200px] text-center">
            {monthNames[month]} {year}
          </h2>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={goToToday}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          اليوم
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Week Days Header */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-3 text-center text-sm font-semibold text-gray-700 bg-gray-50"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: adjustedStartingDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[100px] border border-gray-100 bg-gray-50" />
          ))}

          {/* Days of the month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayBookings = getBookingsForDate(day);
            const isToday =
              dateStr === new Date().toISOString().split("T")[0];
            const isSelected = selectedDate === String(day);

            return (
              <div
                key={day}
                onClick={() => setSelectedDate(selectedDate === String(day) ? null : String(day))}
                className={`min-h-[100px] border border-gray-200 p-2 cursor-pointer transition-colors ${
                  isToday ? "bg-blue-50 border-blue-300" : ""
                } ${isSelected ? "bg-blue-100 border-blue-500" : "hover:bg-gray-50"}`}
              >
                <div
                  className={`text-sm font-medium mb-1 ${
                    isToday ? "text-blue-600" : "text-gray-700"
                  }`}
                >
                  {day}
                </div>
                <div className="space-y-1">
                  {dayBookings.slice(0, 3).map((booking) => (
                    <div
                      key={booking.id}
                      className={`text-xs p-1 rounded truncate ${
                        booking.type === "manual"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                      }`}
                      title={booking.guest_name}
                    >
                      {booking.guest_name}
                    </div>
                  ))}
                  {dayBookings.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{dayBookings.length - 3} أكثر
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Bookings Details */}
      {selectedDate && selectedDateBookings.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            الحجوزات في {parseInt(selectedDate)} {monthNames[month]} {year}
          </h3>
          <div className="space-y-3">
            {selectedDateBookings.map((booking) => (
              <div
                key={booking.id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">{booking.guest_name}</h4>
                    {booking.unit && (
                      <p className="text-sm text-gray-600 mt-1">
                        {booking.unit.unit_name}
                        {booking.unit.unit_code && (
                          <span className="text-gray-400"> ({booking.unit.unit_code})</span>
                        )}
                      </p>
                    )}
                    {booking.platform_account && (
                      <p className="text-xs text-gray-500 mt-1">
                        الحساب: {booking.platform_account.account_name}
                      </p>
                    )}
                  </div>
                  <div className="text-left">
                    <div className="text-sm text-gray-600">
                      {new Date(booking.checkin_date).toLocaleDateString("ar-EG")} →{" "}
                      {new Date(booking.checkout_date).toLocaleDateString("ar-EG")}
                    </div>
                    <span
                      className={`mt-2 inline-block px-2 py-1 text-xs rounded ${
                        booking.type === "manual"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {booking.type === "manual" ? "يدوي" : "iCal"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">دليل الألوان:</h3>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 rounded"></div>
            <span className="text-gray-600">حجوزات يدوية</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 rounded"></div>
            <span className="text-gray-600">حجوزات من iCal</span>
          </div>
        </div>
      </div>
    </>
  );
}




