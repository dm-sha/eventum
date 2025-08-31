import { Link, NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  IconBars3,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconGrid,
  IconHome,
  IconTag,
  IconTags,
  IconUsers,
  IconX,
} from "./icons";

const AdminLayout = () => {
  const menu = [
    { to: ".", label: "Общие", icon: IconHome, end: true },
    { to: "events", label: "Мероприятия", icon: IconCalendar },
    { to: "participants", label: "Участники", icon: IconUsers },
    { to: "event-tags", label: "Теги мероприятий", icon: IconTag },
    { to: "group-tags", label: "Теги групп", icon: IconTags },
    { to: "groups", label: "Группы", icon: IconGrid },
  ];

  // Sidebar collapsed state with responsive default and persistence
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("adminSidebarCollapsed");
      if (saved !== null) return JSON.parse(saved);
    } catch (_) {
      // ignore
    }
    if (typeof window !== "undefined") {
      return window.innerWidth < 1024; // collapse by default on narrow screens
    }
    return false;
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        "adminSidebarCollapsed",
        JSON.stringify(collapsed)
      );
    } catch (_) {
      // ignore
    }
  }, [collapsed]);

  // Mobile sidebar open/close state
  const [mobileOpen, setMobileOpen] = useState(false);

  const AsideToggleIcon = collapsed ? IconChevronRight : IconChevronLeft;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar across the page */}
      <header className="h-14 bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="h-full px-4 sm:px-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded bg-white border border-gray-200 shadow-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Открыть меню"
            aria-expanded={mobileOpen}
          >
            <IconBars3 />
          </button>
          <Link
            to="/"
            className="text-lg sm:text-xl font-medium text-gray-900 hover:text-gray-700"
          >
            Eventum
          </Link>
        </div>
      </header>

      {/* Content row: sidebar + page */}
      <div className="flex flex-1 min-h-0">
        {/* Mobile scrim (does not cover top bar) */}
        {mobileOpen && (
          <button
            aria-label="Закрыть меню"
            className="lg:hidden fixed left-0 right-0 bottom-0 top-14 bg-black/30 z-30"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`${
            collapsed ? "w-16" : "w-64"
          } bg-white border-r border-gray-200 pt-2 pb-3 pl-0 pr-2 flex flex-col transition-all duration-200 z-40
             fixed left-0 top-14 bottom-0 transform ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:sticky lg:top-14 lg:h-[calc(100vh-56px)] overflow-hidden`}
          aria-label="Админ-меню"
        >
          <div className="lg:hidden flex justify-end pr-2 pb-1">
            <button
              aria-label="Закрыть меню"
              onClick={() => setMobileOpen(false)}
              className="p-2 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <IconX />
            </button>
          </div>
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
                      `flex items-center ${
                        collapsed ? "justify-center" : "justify-start"
                      } gap-3 pl-0 pr-2 py-2 rounded text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors border-l-2 ${
                        isActive ? "bg-gray-100 font-medium border-blue-600" : "border-transparent"
                      }`
                    }
                  >
                    <Icon className="shrink-0 text-gray-600" />
                    <span
                      className={`${
                        collapsed ? "hidden" : "block"
                      } text-sm whitespace-nowrap`}
                    >
                      {item.label}
                    </span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
          <div className="mt-3 px-1">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="w-full flex items-center justify-center gap-2 px-2 py-2 rounded border border-gray-200 hover:bg-gray-100 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={collapsed ? "Раскрыть меню" : "Скрыть меню"}
              aria-expanded={!collapsed}
            >
              <AsideToggleIcon />
              <span className={collapsed ? "hidden" : "text-sm"}>
                {collapsed ? "Открыть" : "Свернуть"}
              </span>
            </button>
          </div>
        </aside>

        {/* Page content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
