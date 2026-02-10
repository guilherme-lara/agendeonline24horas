import React, { createContext, useContext, useState, ReactNode } from "react";
import { Service, Barber } from "@/data/mock-data";

interface BookingState {
  selectedServices: Service[];
  selectedBarber: Barber | null;
  selectedDate: Date | null;
  selectedTime: string | null;
  customerName: string;
  customerPhone: string;
  paymentMethod: "pix" | "card" | null;
  currentStep: number;
}

interface BookingContextType extends BookingState {
  addService: (service: Service) => void;
  removeService: (serviceId: number) => void;
  toggleService: (service: Service) => void;
  setBarber: (barber: Barber) => void;
  setDate: (date: Date) => void;
  setTime: (time: string) => void;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  setPaymentMethod: (method: "pix" | "card") => void;
  setStep: (step: number) => void;
  totalPrice: number;
  totalDuration: number;
  reset: () => void;
}

const initialState: BookingState = {
  selectedServices: [],
  selectedBarber: null,
  selectedDate: null,
  selectedTime: null,
  customerName: "",
  customerPhone: "",
  paymentMethod: null,
  currentStep: 1,
};

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export const BookingProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<BookingState>(initialState);

  const addService = (service: Service) =>
    setState((s) => ({ ...s, selectedServices: [...s.selectedServices, service] }));

  const removeService = (serviceId: number) =>
    setState((s) => ({ ...s, selectedServices: s.selectedServices.filter((sv) => sv.id !== serviceId) }));

  const toggleService = (service: Service) => {
    const exists = state.selectedServices.find((s) => s.id === service.id);
    if (exists) removeService(service.id);
    else addService(service);
  };

  const setBarber = (barber: Barber) => setState((s) => ({ ...s, selectedBarber: barber }));
  const setDate = (date: Date) => setState((s) => ({ ...s, selectedDate: date, selectedTime: null }));
  const setTime = (time: string) => setState((s) => ({ ...s, selectedTime: time }));
  const setCustomerName = (name: string) => setState((s) => ({ ...s, customerName: name }));
  const setCustomerPhone = (phone: string) => setState((s) => ({ ...s, customerPhone: phone }));
  const setPaymentMethod = (method: "pix" | "card") => setState((s) => ({ ...s, paymentMethod: method }));
  const setStep = (step: number) => setState((s) => ({ ...s, currentStep: step }));
  const reset = () => setState(initialState);

  const totalPrice = state.selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = state.selectedServices.reduce((sum, s) => sum + s.duration, 0);

  return (
    <BookingContext.Provider
      value={{ ...state, addService, removeService, toggleService, setBarber, setDate, setTime, setCustomerName, setCustomerPhone, setPaymentMethod, setStep, totalPrice, totalDuration, reset }}
    >
      {children}
    </BookingContext.Provider>
  );
};

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) throw new Error("useBooking must be used within BookingProvider");
  return context;
};
