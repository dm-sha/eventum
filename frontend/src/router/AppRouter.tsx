import { Route, Routes } from "react-router-dom";
import Layout from "../components/Layout";
import HomePage from "../pages/HomePage";
import EventumPage from "../pages/EventumPage";
import NotFoundPage from "../pages/NotFoundPage";
import AdminLayout from "../components/AdminLayout";
import AdminInfoPage from "../pages/admin/InfoPage";
import AdminEventsPage from "../pages/admin/EventsPage";
import AdminParticipantsPage from "../pages/admin/ParticipantsPage";
import AdminEventTagsPage from "../pages/admin/EventTagsPage";
import AdminGroupTagsPage from "../pages/admin/GroupTagsPage";
import AdminGroupsPage from "../pages/admin/GroupsPage";
import DashboardPage from "../pages/DashboardPage";

export const AppRouter = () => {
  return (
    <Routes>
      {/* Public site layout */}
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path=":eventumSlug" element={<EventumPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Admin layout is full-width and handles its own sidebar/header */}
      <Route path="/:eventumSlug/admin" element={<AdminLayout />}>
        <Route index element={<AdminInfoPage />} />
        <Route path="events" element={<AdminEventsPage />} />
        <Route path="participants" element={<AdminParticipantsPage />} />
        <Route path="event-tags" element={<AdminEventTagsPage />} />
        <Route path="group-tags" element={<AdminGroupTagsPage />} />
        <Route path="groups" element={<AdminGroupsPage />} />
      </Route>
    </Routes>
  );
};
