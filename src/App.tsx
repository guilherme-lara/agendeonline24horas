import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BookingProvider } from "@/contexts/BookingContext";
import Header from "@/components/Header";
import FloatingCTA from "@/components/FloatingCTA";
import SaaSLanding from "./pages/SaaSLanding";
import Booking from "./pages/Booking";
import BookingSuccess from "./pages/BookingSuccess";
import MyAppointments from "./pages/MyAppointments";
import Admin from "./pages/Admin";
import Dashboard from "./pages/Dashboard";
import SuperAdmin from "./pages/SuperAdmin";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Subscribe from "./pages/Subscribe";
import PublicBooking from "./pages/PublicBooking";
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
            <Route path="/" element={<SaaSLanding />} />
            <Route path="/booking" element={<Booking />} />
            <Route path="/booking/success" element={<BookingSuccess />} />
            <Route path="/appointments" element={<MyAppointments />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/subscribe/:planId" element={<Subscribe />} />
            <Route path="/book/:slug" element={<PublicBooking />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <FloatingCTA />
        </BookingProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
