import barber1 from "@/assets/barber-1.jpg";
import barber2 from "@/assets/barber-2.jpg";
import barber3 from "@/assets/barber-3.jpg";
import barber4 from "@/assets/barber-4.jpg";

export interface Service {
  id: number;
  name: string;
  price: number;
  duration: number; // minutes
  description: string;
  icon: string;
}

export interface Barber {
  id: number;
  name: string;
  avatar: string;
  rating: number;
  specialty: string;
  reviewCount: number;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface Appointment {
  id: string;
  date: string;
  time: string;
  barber: Barber;
  services: Service[];
  status: "confirmed" | "completed" | "cancelled";
  totalPrice: number;
}

export const services: Service[] = [
  { id: 1, name: "Corte Degradê", price: 50, duration: 40, description: "Corte moderno com degradê perfeito", icon: "scissors" },
  { id: 2, name: "Corte Social", price: 45, duration: 35, description: "Corte clássico e elegante", icon: "scissors" },
  { id: 3, name: "Barba Completa", price: 35, duration: 30, description: "Modelagem e hidratação da barba", icon: "user" },
  { id: 4, name: "Sobrancelha", price: 15, duration: 10, description: "Design e limpeza de sobrancelha", icon: "eye" },
  { id: 5, name: "Corte + Barba", price: 75, duration: 60, description: "Combo completo corte e barba", icon: "star" },
  { id: 6, name: "Pigmentação", price: 80, duration: 45, description: "Pigmentação capilar profissional", icon: "palette" },
];

export const barbers: Barber[] = [
  { id: 1, name: "Carlos Silva", avatar: barber1, rating: 4.9, specialty: "Degradê & Cortes Modernos", reviewCount: 234 },
  { id: 2, name: "Rafael Santos", avatar: barber2, rating: 4.8, specialty: "Barba Artística", reviewCount: 189 },
  { id: 3, name: "Lucas Oliveira", avatar: barber3, rating: 4.7, specialty: "Cortes Clássicos", reviewCount: 156 },
  { id: 4, name: "André Costa", avatar: barber4, rating: 4.9, specialty: "Pigmentação & Design", reviewCount: 312 },
];

export const generateTimeSlots = (date: Date): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const hours = [9, 10, 11, 13, 14, 15, 16, 17, 18, 19];
  const day = date.getDay();

  // Closed on Sundays
  if (day === 0) return [];

  // Saturday shorter hours
  const availableHours = day === 6 ? hours.filter(h => h <= 16) : hours;

  availableHours.forEach((hour) => {
    [0, 30].forEach((min) => {
      const time = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
      // Simulate some occupied slots
      const available = Math.random() > 0.3;
      slots.push({ time, available });
    });
  });

  return slots;
};

export const mockAppointments: Appointment[] = [
  {
    id: "1",
    date: "2026-02-12",
    time: "14:00",
    barber: barbers[0],
    services: [services[0]],
    status: "confirmed",
    totalPrice: 50,
  },
  {
    id: "2",
    date: "2026-02-15",
    time: "10:30",
    barber: barbers[1],
    services: [services[4]],
    status: "confirmed",
    totalPrice: 75,
  },
  {
    id: "3",
    date: "2026-01-28",
    time: "15:00",
    barber: barbers[2],
    services: [services[0], services[2]],
    status: "completed",
    totalPrice: 85,
  },
  {
    id: "4",
    date: "2026-01-20",
    time: "11:00",
    barber: barbers[0],
    services: [services[1]],
    status: "completed",
    totalPrice: 45,
  },
];
