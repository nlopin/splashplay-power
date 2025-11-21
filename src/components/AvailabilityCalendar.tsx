import { useEffect, useState } from "react";

type Availability = {
  inviteesRemaining: number;
  schedulingUrl: string;
  startTime: string;
  status: string;
};

type SelectedTimeSlot = {
  startTime: string;
  formattedDate: string;
  formattedTime: string;
  schedulingUrl: string;
};

export default function AvailabilityCalendar({
  availability,
  onTimeSlotSelect,
  selectedTimeSlot,
}: {
  availability: Availability[];
  onTimeSlotSelect?: (slot: SelectedTimeSlot | null) => void;
  selectedTimeSlot?: SelectedTimeSlot | null;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [internalSelectedSlot, setInternalSelectedSlot] = useState<
    string | null
  >(null);

  const groupedAvailability = availability.reduce(
    (acc, slot) => {
      const date = new Date(slot.startTime);

      const day = date.toLocaleDateString("en-GB", { day: "2-digit" });
      const month = date.toLocaleDateString("en-GB", { month: "2-digit" });
      const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
      const formattedDate = `${day}.${month} ${weekday}`;

      if (!acc[formattedDate]) {
        acc[formattedDate] = [];
      }
      acc[formattedDate].push(slot);
      return acc;
    },
    {} as Record<string, Availability[]>,
  );

  const dates = Object.keys(groupedAvailability);

  // Initialize selected date if we have a selected time slot
  useEffect(() => {
    if (selectedTimeSlot && !selectedDate) {
      setSelectedDate(selectedTimeSlot.formattedDate);
      setInternalSelectedSlot(selectedTimeSlot.startTime);
    }
  }, [selectedTimeSlot, selectedDate]);

  const handleTimeSlotClick = (slot: Availability) => {
    const date = new Date(slot.startTime);
    const formattedDate = selectedDate!;
    const formattedTime = date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const selectedSlot: SelectedTimeSlot = {
      startTime: slot.startTime,
      formattedDate,
      formattedTime,
      schedulingUrl: slot.schedulingUrl,
    };

    setInternalSelectedSlot(slot.startTime);
    onTimeSlotSelect?.(selectedSlot);
  };

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    // Clear time slot selection when changing date
    if (selectedDate !== date) {
      setInternalSelectedSlot(null);
      onTimeSlotSelect?.(null);
    }
  };

  const currentSelectedSlot =
    selectedTimeSlot?.startTime || internalSelectedSlot;

  return (
    <div
      className="availability-calendar"
      style={{ display: "flex", gap: "2rem", marginBottom: "2rem" }}
    >
      <div className="dates-column" style={{ flex: 1 }}>
        <h3 style={{ marginBottom: "1rem", color: "#333" }}>Available Dates</h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {dates.map((date) => (
            <li
              key={date}
              onClick={() => handleDateClick(date)}
              className={selectedDate === date ? "selected" : ""}
              style={{
                padding: "12px 16px",
                margin: "8px 0",
                backgroundColor: selectedDate === date ? "#007cba" : "#f8f9fa",
                color: selectedDate === date ? "white" : "#333",
                border: "1px solid #e9ecef",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                fontWeight: selectedDate === date ? "bold" : "normal",
              }}
              onMouseEnter={(e) => {
                if (selectedDate !== date) {
                  e.currentTarget.style.backgroundColor = "#e3f2fd";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedDate !== date) {
                  e.currentTarget.style.backgroundColor = "#f8f9fa";
                }
              }}
            >
              {date}
            </li>
          ))}
        </ul>
      </div>

      <div className="times-column" style={{ flex: 1 }}>
        {selectedDate && (
          <>
            <h3 style={{ marginBottom: "1rem", color: "#333" }}>
              Available Times
            </h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {groupedAvailability[selectedDate].map((slot) => {
                const time = new Date(slot.startTime).toLocaleTimeString(
                  "en-GB",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                );
                const isSelected = currentSelectedSlot === slot.startTime;

                return (
                  <li
                    key={slot.startTime}
                    onClick={() => handleTimeSlotClick(slot)}
                    className={isSelected ? "selected" : ""}
                    style={{
                      padding: "12px 16px",
                      margin: "8px 0",
                      backgroundColor: isSelected ? "#007cba" : "#f8f9fa",
                      color: isSelected ? "white" : "#333",
                      border: "1px solid #e9ecef",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      fontWeight: isSelected ? "bold" : "normal",
                      textAlign: "center" as const,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = "#e3f2fd";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = "#f8f9fa";
                      }
                    }}
                  >
                    {time}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
