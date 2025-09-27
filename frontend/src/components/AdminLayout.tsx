import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Header from "./Header";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconHome,
  IconUsersCircle,
  IconMapPin,
  IconEventTag,
  IconGroupTag,
  IconParticipantGroup,
} from "./icons";

const AdminLayout = () => {
  const location = useLocation();
  const menu = [
    { to: ".", label: "Общие", icon: IconHome, end: true },
    { to: "locations", label: "Локации", icon: IconMapPin },
    { to: "events", label: "Мероприятия", icon: IconCalendar },
    { to: "event-tags", label: "Теги мероприятий", icon: IconEventTag },
    { to: "participants", label: "Участники", icon: IconUsersCircle },
    { to: "groups", label: "Группы участников", icon: IconParticipantGroup },
    { to: "group-tags", label: "Теги групп", icon: IconGroupTag },
  ];

  // Sidebar collapsed state with persistence
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("adminSidebarCollapsed");
      if (saved !== null) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return false; // По умолчанию развернута
  });


  useEffect(() => {
    try {
      localStorage.setItem(
        "adminSidebarCollapsed",
        JSON.stringify(collapsed)
      );
    } catch {
      // ignore
    }
  }, [collapsed]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

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
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
