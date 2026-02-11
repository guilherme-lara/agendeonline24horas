import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BookingProvider } from "@/contexts/BookingContext";
import Header from "@/components/Header";
import FloatingCTA from "@/components/FloatingCTA";
import Index from "./pages/Index";
import Booking from "./pages/Booking";
import BookingSuccess from "./pages/BookingSuccess";
import MyAppointments from "./pages/MyAppointments";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import Subscribe from "./pages/Subscribe";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <BookingProvider>
          <Header />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/booking" element={<Booking />} />
            <Route path="/booking/success" element={<BookingSuccess />} />
            <Route path="/appointments" element={<MyAppointments />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/login" element={<Login />} />
            <Route path="/subscribe/:planId" element={<Subscribe />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <FloatingCTA />
        </BookingProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
