export type AppointmentMatch = {
  id: string;
  customer_id?: string | null;
  client_phone?: string | null;
  status?: string | null;
  scheduled_at: string;
};

export type CustomerMatch = {
  id: string;
  phone: string;
};

const INACTIVE_STATUSES = new Set(["completed", "cancelled"]);

export function normalizePhone(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const pa = normalizePhone(a);
  const pb = normalizePhone(b);
  if (pa.length < 8 || pb.length < 8) return false;
  return pa === pb || pa.endsWith(pb) || pb.endsWith(pa);
}

export function findActiveAppointmentForCustomer<T extends AppointmentMatch>(
  appointments: T[],
  customer: CustomerMatch,
): T | null {
  const matches = appointments.filter((appointment) => {
    if (INACTIVE_STATUSES.has(appointment.status ?? "")) return false;
    if (appointment.customer_id && appointment.customer_id === customer.id) return true;
    return phonesMatch(appointment.client_phone, customer.phone);
  });

  matches.sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
  );

  const now = Date.now();
  return matches.find((appointment) => new Date(appointment.scheduled_at).getTime() >= now) ?? matches[0] ?? null;
}
