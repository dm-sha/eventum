import { NavLink, Outlet } from "react-router-dom";

const AdminLayout = () => {
  const menu = [
    { to: ".", label: "Общие", end: true },
    { to: "events", label: "Мероприятия" },
    { to: "participants", label: "Участники" },
    { to: "event-tags", label: "Теги мероприятий" },
    { to: "group-tags", label: "Теги групп" },
    { to: "groups", label: "Группы" },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 p-4">
        <nav className="space-y-2">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-gray-700 hover:bg-gray-100 ${
                  isActive ? "bg-gray-100 font-medium" : ""
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
