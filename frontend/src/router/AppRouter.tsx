import { Route, Routes } from "react-router-dom";
import Layout from "../components/Layout";
import HomePage from "../pages/HomePage";
import EventumPage from "../pages/EventumPage";
import NotFoundPage from "../pages/NotFoundPage";
import AdminLayout from "../components/AdminLayout";
import AdminInfoPage from "../pages/admin/AdminInfoPage";
import AdminEventsPage from "../pages/admin/AdminEventsPage";
import AdminParticipantsPage from "../pages/admin/AdminParticipantsPage";
import AdminEventTagsPage from "../pages/admin/AdminEventTagsPage";
import AdminGroupTagsPage from "../pages/admin/AdminGroupTagsPage";
import AdminGroupsPage from "../pages/admin/AdminGroupsPage";

export const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/:eventumSlug" element={<EventumPage />} />
        <Route path="/:eventumSlug/admin" element={<AdminLayout />}>
          <Route index element={<AdminInfoPage />} />
          <Route path="events" element={<AdminEventsPage />} />
          <Route path="participants" element={<AdminParticipantsPage />} />
          <Route path="event-tags" element={<AdminEventTagsPage />} />
          <Route path="group-tags" element={<AdminGroupTagsPage />} />
          <Route path="groups" element={<AdminGroupsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
