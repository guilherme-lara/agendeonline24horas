import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
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

  const addService = useCallback((service: Service) =>
    setState((s) => ({ ...s, selectedServices: [...s.selectedServices, service] })), []);

  const removeService = useCallback((serviceId: number) =>
    setState((s) => ({ ...s, selectedServices: s.selectedServices.filter((sv) => sv.id !== serviceId) })), []);

  const toggleService = useCallback((service: Service) => {
    setState((s) => {
      const exists = s.selectedServices.find((sv) => sv.id === service.id);
      return exists
        ? { ...s, selectedServices: s.selectedServices.filter((sv) => sv.id !== service.id) }
        : { ...s, selectedServices: [...s.selectedServices, service] };
    });
  }, []);

  const setBarber = useCallback((barber: Barber) => setState((s) => ({ ...s, selectedBarber: barber })), []);
  const setDate = useCallback((date: Date) => setState((s) => ({ ...s, selectedDate: date, selectedTime: null })), []);
  const setTime = useCallback((time: string) => setState((s) => ({ ...s, selectedTime: time })), []);
  const setCustomerName = useCallback((name: string) => setState((s) => ({ ...s, customerName: name })), []);
  const setCustomerPhone = useCallback((phone: string) => setState((s) => ({ ...s, customerPhone: phone })), []);
  const setPaymentMethod = useCallback((method: "pix" | "card") => setState((s) => ({ ...s, paymentMethod: method })), []);
  const setStep = useCallback((step: number) => setState((s) => ({ ...s, currentStep: step })), []);
  const reset = useCallback(() => setState(initialState), []);

  const totalPrice = useMemo(() => state.selectedServices.reduce((sum, s) => sum + s.price, 0), [state.selectedServices]);
  const totalDuration = useMemo(() => state.selectedServices.reduce((sum, s) => sum + s.duration, 0), [state.selectedServices]);

  const value = useMemo(
    () => ({ ...state, addService, removeService, toggleService, setBarber, setDate, setTime, setCustomerName, setCustomerPhone, setPaymentMethod, setStep, totalPrice, totalDuration, reset }),
    [state, addService, removeService, toggleService, setBarber, setDate, setTime, setCustomerName, setCustomerPhone, setPaymentMethod, setStep, totalPrice, totalDuration, reset],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
};

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) throw new Error("useBooking must be used within BookingProvider");
  return context;
};
