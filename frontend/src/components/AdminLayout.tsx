import { NavLink, Outlet } from "react-router-dom";
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
  IconUsers,
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

  // Sidebar collapsed state with persistence
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("adminSidebarCollapsed");
      if (saved !== null) return JSON.parse(saved);
    } catch (_) {
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
    } catch (_) {
      // ignore
    }
  }, [collapsed]);

  const AsideToggleIcon = collapsed ? IconChevronRight : IconChevronLeft;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar across the page */}
      <Header variant="admin" />

      {/* Content row: sidebar + page */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className={`${
            collapsed ? "w-16" : "w-64"
          } bg-white border-r border-gray-200 pt-2 pb-3 pl-0 pr-2 flex flex-col transition-all duration-200 z-40 sticky top-14 h-[calc(100vh-56px)] overflow-hidden`}
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
