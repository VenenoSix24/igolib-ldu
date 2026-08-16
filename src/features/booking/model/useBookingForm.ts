import { useEffect, useState } from "react";
import { useSettingsStore, type OpMode, type ExecTime } from "@/stores/settings";

/** 预约表单状态：来源与持久化都走 settings store */
export function useBookingForm() {
  const booking = useSettingsStore((s) => s.booking);
  const setBooking = useSettingsStore((s) => s.setBooking);

  const [selectedSeatKey, setSelectedSeatKey] = useState("");
  const [seatInputMode, setSeatInputMode] = useState<"manual" | "select">("select");

  // 操作模式切换时重置执行时间为该模式的默认值
  useEffect(() => {
    setBooking({ execTime: booking.opMode === "scheduled" ? "2148" : "immediate" });
    // 仅在 opMode 变化时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.opMode]);

  return {
    ...booking,
    setCookieStr: (cookieStr: string) => setBooking({ cookieStr }),
    setLibId: (libId: string) => setBooking({ libId }),
    setSeatNumber: (seatNumber: string) => setBooking({ seatNumber }),
    setOpMode: (opMode: OpMode) => setBooking({ opMode }),
    setExecTime: (execTime: ExecTime) => setBooking({ execTime }),
    setCustomTime: (customTime: string) => setBooking({ customTime }),
    selectedSeatKey,
    setSelectedSeatKey,
    seatInputMode,
    setSeatInputMode,
  };
}

export type BookingForm = ReturnType<typeof useBookingForm>;
