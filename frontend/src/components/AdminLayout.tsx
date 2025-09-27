import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Header from "./Header";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconGrid,
  IconHome,
  IconTag,
  IconTags,
  IconUsersCircle,
  IconMapPin,
} from "./icons";

const AdminLayout = () => {
  const location = useLocation();
  const menu = [
    { to: ".", label: "Общие", icon: IconHome, end: true },
    { to: "events", label: "Мероприятия", icon: IconCalendar },
    { to: "participants", label: "Участники", icon: IconUsersCircle },
    { to: "locations", label: "Локации", icon: IconMapPin },
    { to: "event-tags", label: "Теги мероприятий", icon: IconTag },
    { to: "group-tags", label: "Теги групп", icon: IconTags },
    { to: "groups", label: "Группы", icon: IconGrid },
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
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      {/* Top bar across the page */}
      <Header
        variant="admin"
        onMenuToggle={handleMenuToggle}
        isMenuOpen={isMobileMenuOpen}
        showMenuToggle
      />

      {/* Content row: sidebar + page */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
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
          className={`fixed top-14 bottom-0 left-0 z-30 w-64 translate-x-0 transform border-r border-gray-200 bg-white pb-3 pl-0 pr-2 pt-2 shadow-lg transition-transform duration-200 ease-in-out lg:static lg:h-full lg:translate-x-0 lg:shadow-none ${
            collapsed ? "lg:w-20" : "lg:w-64"
          } ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
          aria-label="Админ-меню"
        >
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-2">
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
                        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          isActive
                            ? "bg-blue-50 text-blue-700"
                            : "hover:bg-gray-100"
                        } ${collapsed ? "lg:justify-center lg:px-2" : ""}`
                      }
                    >
                      <Icon className="shrink-0" />
                      <span
                        className={`whitespace-nowrap transition-opacity duration-150 ${
                          collapsed ? "lg:invisible lg:w-0 lg:opacity-0" : ""
                        }`}
                      >
                        {item.label}
                      </span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
            <div className="mt-auto border-t border-gray-200 px-2 pt-3">
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={collapsed ? "Раскрыть меню" : "Скрыть меню"}
                aria-expanded={!collapsed}
              >
                <AsideToggleIcon />
                <span className={`${collapsed ? "hidden" : ""}`}>
                  Свернуть
                </span>
              </button>
            </div>
          </div>
        </aside>

        {/* Page content */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
