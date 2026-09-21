$content = Get-Content -Path "src\pages\PublicBooking.tsx" -Raw
$find = '(?s)  const timeSlots = useMemo\(\(\) => \{.*?\n  \}, \[selectedDate, cartItems, totalCartDuration, shopResources, existingAppts, step\]\);'

$replace = @'
  const timeSlots = useMemo(() => {
    if (!selectedDate || !shopResources) return [];

    const serviceItems = cartItems.filter((i) => i.type === "service");
    if (serviceItems.length === 0 && step < 4) return [];

    const firstServiceInCategory = shopResources.services.find((s: any) => s.category_id === selectedCategory);
    const durationToUse = totalCartDuration || Number(firstServiceInCategory?.duration || 30);

    const dayOfWeek = selectedDate.getDay();
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    // 1. Encontrar profissionais candidatos
    let candidateBarbers = availableBarbers;
    if (selectedBarber) {
      candidateBarbers = [selectedBarber];
    }

    // 2. Filtrar candidatos por escala de trabalho (schedules) e folgas (timeOffs)
    candidateBarbers = candidateBarbers.filter(b => {
       const isOff = shopResources.timeOffs.some(off => off.barber_id === b.id && off.start_date <= dateStr && off.end_date >= dateStr);
       if (isOff) return false;
       const sched = shopResources.schedules.find(s => s.barber_id === b.id && s.day_of_week === dayOfWeek);
       if (!sched || !sched.is_working) return false;
       return true;
    });

    if (candidateBarbers.length === 0) return [];

    const slots: string[] = [];
    const nowBrtMinutes = getNowBrtMinutes();

    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slotStartMinutes = h * 60 + m;
        // Blindagem de fuso
        if (isToday(selectedDate) && slotStartMinutes <= nowBrtMinutes) continue;
        const slotEndMinutes = slotStartMinutes + durationToUse + BUFFER_MINUTES;

        // Slot é válido se PELO MENOS UM candidato pode atender
        const canFulfill = candidateBarbers.some(b => {
           const sched = shopResources.schedules.find(s => s.barber_id === b.id && s.day_of_week === dayOfWeek);
           if (!sched) return false;

           const [startH, startM] = sched.start_time.split(":").map(Number);
           const [endH, endM] = sched.end_time.split(":").map(Number);
           const workStartMinutes = startH * 60 + startM;
           const workEndMinutes = endH * 60 + endM;

           if (slotStartMinutes < workStartMinutes || slotEndMinutes > workEndMinutes) return false;

           const hasConflict = existingAppts.some((appt: any) => {
              if (appt.barber_id !== b.id) return false;
              const apptStart = getBrtMinutesFromScheduledAt(appt.scheduled_at);
              const apptDuration = serviceDurationByName.get(appt.service_name) || 30;
              const apptEnd = apptStart + apptDuration + BUFFER_MINUTES;
              return hasTimeOverlap(slotStartMinutes, slotEndMinutes, apptStart, apptEnd);
           });

           return !hasConflict;
        });

        if (canFulfill) {
           slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        }
      }
    }
    return slots;
  }, [selectedDate, cartItems, totalCartDuration, shopResources, existingAppts, step, availableBarbers, selectedBarber, selectedCategory, serviceDurationByName]);
'@

$content = $content -replace $find, $replace
$content | Set-Content -Path "src\pages\PublicBooking.tsx"
