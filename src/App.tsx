import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import Settings from "./pages/app/Settings";
import Courses from "./pages/app/Courses";
import Assignments from "./pages/app/Assignments";
import Standards from "./pages/app/Standards";
import Mastery from "./pages/app/Mastery";
import MasteryDebug from "./pages/app/MasteryDebug";
import Review from "./pages/app/Review";
import Analytics from "./pages/app/Analytics";
import QuestionBank from "./pages/app/QuestionBank";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="courses" element={<Courses />} />
            <Route path="assignments" element={<Assignments />} />
            <Route path="review" element={<Review />} />
            <Route path="standards" element={<Standards />} />
            <Route path="question-bank" element={<QuestionBank />} />
            <Route path="mastery" element={<Mastery />} />
            <Route path="mastery/debug" element={<MasteryDebug />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
