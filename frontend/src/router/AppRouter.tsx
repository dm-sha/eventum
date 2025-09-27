import { Route, Routes, Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import EventumPage from "../pages/EventumPage";
import NotFoundPage from "../pages/NotFoundPage";
import AdminLayout from "../components/AdminLayout";
import EventumInfoPage from "../pages/admin/EventumInfoPage";
import AdminEventsPage from "../pages/admin/EventsPage";
import AdminParticipantsPage from "../pages/admin/ParticipantsPage";
import AdminEventTagsPage from "../pages/admin/EventTagsPage";
import AdminGroupTagsPage from "../pages/admin/GroupTagsPage";
import AdminGroupsPage from "../pages/admin/GroupsPage";
import VKAuth from "../components/VKAuth";
import DashboardPage from "../pages/DashboardPage";
import HomePage from "../pages/HomePage";
import { useAuth } from "../contexts/AuthContext";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div>Загрузка...</div>;
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
};

export const AppRouter = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Загрузка...</div>;
  }

  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <VKAuth />} />
      
      {/* Dashboard route */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } 
      />

      {/* Public site layout */}
      <Route path="/" element={<Layout />}>
        <Route index element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <HomePage />} />
        <Route path=":eventumSlug" element={<EventumPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Admin layout is full-width and handles its own sidebar/header */}
      <Route path="/:eventumSlug/admin" element={<AdminLayout />}>
        <Route index element={<EventumInfoPage />} />
        <Route path="events" element={<AdminEventsPage />} />
        <Route path="participants" element={<AdminParticipantsPage />} />
        <Route path="event-tags" element={<AdminEventTagsPage />} />
        <Route path="group-tags" element={<AdminGroupTagsPage />} />
        <Route path="groups" element={<AdminGroupsPage />} />
      </Route>
    </Routes>
  );
};
