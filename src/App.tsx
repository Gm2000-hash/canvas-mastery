import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

// /app/standards moved into Library as a view; keep tab/std params.
function LegacyStandardsRedirect() {
  const { search } = useLocation();
  const p = new URLSearchParams(search);
  p.set("view", "standards");
  return <Navigate to={`/app/library?${p.toString()}`} replace />;
}
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
import MasteryDebug from "./pages/app/MasteryDebug";
import Analytics from "./pages/app/Analytics";

import StudentHistory from "./pages/app/StudentHistory";
import Admin from "./pages/app/Admin";
import Library from "./pages/app/Library";
import Department from "./pages/app/Department";
import DepartmentDashboard from "./pages/app/DepartmentDashboard";
import BuildingAnalytics from "./pages/app/BuildingAnalytics";
import BuildingStudent from "./pages/app/BuildingStudent";
import PendingApproval from "./pages/app/PendingApproval";
import { curriculumAppRoutes, curriculumPublicRoutes } from "./modules/curriculum/routes";

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
            <Route path="assignments" element={<Navigate to="/app/classes" replace />} />
            <Route path="assignment-groups" element={<Navigate to="/app/classes?view=groups" replace />} />
            <Route path="review" element={<Navigate to="/app/library?view=standards&tab=questions" replace />} />
            <Route path="standards" element={<LegacyStandardsRedirect />} />
            <Route path="question-bank" element={<Navigate to="/app/library?view=standards&tab=questions" replace />} />
            
            <Route path="mastery/debug" element={<MasteryDebug />} />
            <Route path="student-history" element={<StudentHistory />} />
            <Route path="settings" element={<Settings />} />
            <Route path="library" element={<Library />} />
            <Route path="mastery-connect" element={<Navigate to="/app/library" replace />} />
            <Route path="department" element={<Department />} />
            <Route path="department/:subject" element={<DepartmentDashboard />} />
            <Route path="building" element={<BuildingAnalytics />} />
            <Route path="building/students/:studentId" element={<BuildingStudent />} />
            <Route path="pending" element={<PendingApproval />} />
            <Route path="admin" element={<Admin />} />
            {curriculumAppRoutes()}
          </Route>
          {curriculumPublicRoutes()}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
