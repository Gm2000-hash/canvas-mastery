import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import Settings from "./pages/app/Settings";
import ClassesHub from "./pages/app/ClassesHub";
import Assignments from "./pages/app/Assignments";
import Standards from "./pages/app/Standards";
import MasteryDebug from "./pages/app/MasteryDebug";
import Review from "./pages/app/Review";
import Analytics from "./pages/app/Analytics";
import QuestionBank from "./pages/app/QuestionBank";
import StudentHistory from "./pages/app/StudentHistory";
import Admin from "./pages/app/Admin";
import AssignmentGroups from "./pages/app/AssignmentGroups";
import MasteryConnect from "./pages/app/MasteryConnect";

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
            <Route path="classes" element={<ClassesHub />} />
            <Route path="classes/:courseId" element={<Analytics />} />
            <Route path="classes/:courseId/assignments" element={<Assignments />} />
            <Route path="courses" element={<Navigate to="/app/classes" replace />} />
            <Route path="analytics" element={<Navigate to="/app/classes" replace />} />
            <Route path="assignments" element={<Assignments />} />
            <Route path="assignment-groups" element={<AssignmentGroups />} />
            <Route path="review" element={<Review />} />
            <Route path="standards" element={<Standards />} />
            <Route path="question-bank" element={<QuestionBank />} />
            <Route path="mastery/debug" element={<MasteryDebug />} />
            <Route path="student-history" element={<StudentHistory />} />
            <Route path="settings" element={<Settings />} />
            <Route path="mastery-connect" element={<MasteryConnect />} />
            <Route path="admin" element={<Admin />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
