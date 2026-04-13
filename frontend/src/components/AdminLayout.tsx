import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AdminDataProvider } from "../contexts/AdminDataContext";
import { useAuth } from "../contexts/AuthContext";
import Header from "./Header";
import VKAuth from "./VKAuth";
import { authApi } from "../api/eventumApi";
import { getEventumBySlug } from "../api/eventum";
import { useEventumSlug } from "../hooks/useEventumSlug";
import { getEventumScopedPath } from "../utils/eventumSlug";
import type { UserRole } from "../types";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconHome,
  IconUsersCircle,
  IconMapPin,
  IconEventTag,
  IconParticipantGroup,
  IconClipboardDocumentList,
} from "./icons";

const isOrganizerForEventum = (roles: UserRole[], eventumId: number): boolean =>
  roles.some((role) => {
    const roleEventumId =
      typeof role.eventum === "object" && role.eventum !== null
        ? (role.eventum as { id: number }).id
        : role.eventum;
    return roleEventumId === eventumId && role.role === "organizer";
  });

const AdminLayout = () => {
  const location = useLocation();
  const eventumSlug = useEventumSlug();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [accessLoading, setAccessLoading] = useState(isAuthenticated);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setAccessLoading(false);
      setAccessDenied(false);
      setAccessError(null);
      return;
    }

    if (!eventumSlug) {
      setAccessLoading(false);
      setAccessDenied(true);
      setAccessError(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setAccessLoading(true);
      setAccessDenied(false);
      setAccessError(null);
      try {
        const [rolesRes, eventum] = await Promise.all([
          authApi.getRoles(),
          getEventumBySlug(eventumSlug),
        ]);
        if (cancelled) return;
        if (!isOrganizerForEventum(rolesRes.data, eventum.id)) {
          setAccessDenied(true);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 403 || status === 404) {
          setAccessDenied(true);
        } else {
          setAccessError("Не удалось проверить доступ к админке. Попробуйте обновить страницу.");
        }
      } finally {
        if (!cancelled) {
          setAccessLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading, eventumSlug]);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("adminSidebarCollapsed");
      if (saved !== null) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return false;
  });

  useEffect(() => {
    try {
      localStorage.setItem("adminSidebarCollapsed", JSON.stringify(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        Загрузка...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <VKAuth />;
  }

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        Загрузка...
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <p className="text-gray-700">{accessError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Обновить страницу
        </button>
      </div>
    );
  }

  if (accessDenied || !eventumSlug) {
    const backTo = eventumSlug ? getEventumScopedPath(eventumSlug, "/general") : "/";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
          <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-gray-900">Админка недоступна</h1>
        <p className="mt-2 max-w-md text-gray-600">
          Раздел администрирования события доступен только организаторам этого события.
        </p>
        <Link
          to={backTo}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          На страницу события
        </Link>
      </div>
    );
  }

  const menu = [
    { to: ".", label: "Общие", icon: IconHome, end: true },
    { to: "locations", label: "Локации", icon: IconMapPin },
    { to: "events", label: "Мероприятия", icon: IconCalendar },
    { to: "registration", label: "Регистрация на мероприятия", icon: IconClipboardDocumentList },
    { to: "event-tags", label: "Теги мероприятий", icon: IconEventTag },
    { to: "participants", label: "Участники", icon: IconUsersCircle },
    { to: "groups", label: "Группы участников", icon: IconParticipantGroup },
  ];

  const AsideToggleIcon = collapsed ? IconChevronRight : IconChevronLeft;

  const handleMenuToggle = () => {
    setIsMobileMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setCollapsed(false);
      }
      return next;
    });
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Top bar across the page */}
      <Header
        variant="admin"
        onMenuToggle={handleMenuToggle}
        isMenuOpen={isMobileMenuOpen}
        showMenuToggle
      />

      {/* Content row: sidebar + page */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Backdrop for mobile menu */}
        {isMobileMenuOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={handleMenuToggle}
            aria-label="Закрыть меню"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`${
            collapsed ? "lg:w-20" : "lg:w-64"
          } fixed top-14 bottom-0 left-0 z-30 w-64 transform bg-white border-r border-gray-200 pt-2 pb-3 pl-0 pr-2 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 lg:h-full ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-label="Админ-меню"
        >
          <div className="flex-1 overflow-y-auto">
            <nav className="space-y-1">
              {menu.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    title={item.label}
                    aria-label={item.label}
                    className={({ isActive }) =>
                      `flex items-center justify-start gap-3 px-3 py-2 rounded text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors border-l-4 ${
                        isActive ? "bg-gray-100 font-medium border-blue-600" : "border-transparent"
                      } ${collapsed ? "lg:justify-center lg:px-2 lg:border-l-0" : ""}`
                    }
                  >
                    <Icon className="shrink-0 text-gray-600" />
                    <span
                      className={`${
                        collapsed ? "lg:hidden" : ""
                      } text-sm whitespace-nowrap`}
                    >
                      {item.label}
                    </span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
          <div className="mt-auto px-1">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="w-full flex items-center justify-center gap-2 px-2 py-2 rounded border border-gray-200 hover:bg-gray-100 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={collapsed ? "Раскрыть меню" : "Скрыть меню"}
              aria-expanded={!collapsed}
            >
              <AsideToggleIcon />
              <span className={`text-sm ${collapsed ? 'hidden' : ''}`}>
                {collapsed ? "" : "Свернуть"}
              </span>
            </button>
          </div>
        </aside>

        {/* Page content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <AdminDataProvider>
            <Outlet />
          </AdminDataProvider>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
