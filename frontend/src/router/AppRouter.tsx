import { Route, Routes, Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import EventumPage from "../pages/EventumPage";
import NotFoundPage from "../pages/NotFoundPage";
import AdminLayout from "../components/AdminLayout";
import EventumInfoPage from "../pages/admin/EventumInfoPage";
import AdminEventsPage from "../pages/admin/EventsPage";
import EventRegistrationPage from "../pages/admin/EventRegistration";
import AdminParticipantsPage from "../pages/admin/ParticipantsPage";
import AdminEventTagsPage from "../pages/admin/EventTagsPage";
import AdminGroupsPage from "../pages/admin/GroupsPage";
import LocationsPage from "../pages/admin/LocationsPage";
import VKAuth from "../components/VKAuth";
import DashboardPage from "../pages/DashboardPage";
import HomePage from "../pages/HomePage";
import { useAuth } from "../contexts/AuthContext";
import { getSubdomainSlug } from "../utils/eventumSlug";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div>Загрузка...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

export const AppRouter = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const subdomainSlug = getSubdomainSlug();

  if (isLoading) {
    return <div>Загрузка...</div>;
  }

  const adminRoutes = (
    <>
      <Route index element={<EventumInfoPage />} />
      <Route path="events" element={<AdminEventsPage />} />
      <Route path="registration" element={<EventRegistrationPage />} />
      <Route path="participants" element={<AdminParticipantsPage />} />
      <Route path="event-tags" element={<AdminEventTagsPage />} />
      <Route path="groups" element={<AdminGroupsPage />} />
      <Route path="locations" element={<LocationsPage />} />
    </>
  );

  const homeElement = subdomainSlug
    ? (isAuthenticated ? <EventumPage /> : <VKAuth />)
    : (isAuthenticated ? <Navigate to="/dashboard" replace /> : <HomePage />);

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
        <Route index element={homeElement} />
        {subdomainSlug ? (
          // При использовании поддомена не включаем slug в путь
          <>
            <Route index element={<Navigate to="general" replace />} />
            <Route path="general" element={isAuthenticated ? <EventumPage /> : <VKAuth />} />
            <Route path="registration" element={isAuthenticated ? <EventumPage /> : <VKAuth />} />
            <Route path="distribution" element={isAuthenticated ? <EventumPage /> : <VKAuth />} />
            <Route path="schedule" element={isAuthenticated ? <EventumPage /> : <VKAuth />} />
          </>
        ) : (
          // При использовании основного домена включаем slug в путь
          <Route path=":eventumSlug" element={<EventumPage />}>
            <Route index element={<Navigate to="general" replace />} />
            <Route path="general" element={<EventumPage />} />
            <Route path="registration" element={<EventumPage />} />
            <Route path="distribution" element={<EventumPage />} />
            <Route path="schedule" element={<EventumPage />} />
          </Route>
        )}
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Admin layout is full-width and handles its own sidebar/header */}
      {subdomainSlug && (
        <Route path="/admin" element={<AdminLayout />}>
          {adminRoutes}
        </Route>
      )}
      <Route path="/:eventumSlug/admin" element={<AdminLayout />}>
        <Route index element={<EventumInfoPage />} />
        <Route path="events" element={<AdminEventsPage />} />
        <Route path="registration" element={<EventRegistrationPage />} />
        <Route path="participants" element={<AdminParticipantsPage />} />
        <Route path="event-tags" element={<AdminEventTagsPage />} />
        <Route path="groups" element={<AdminGroupsPage />} />
        <Route path="locations" element={<LocationsPage />} />
      </Route>
    </Routes>
  );
};
