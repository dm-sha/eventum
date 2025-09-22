import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const Layout = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="text-xl font-medium text-gray-900 hover:text-gray-700"
          >
            Eventum
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link
              to="/dashboard"
              className="px-3 py-1.5 rounded-md border border-transparent text-gray-700 hover:text-blue-600 hover:border-blue-600 transition"
            >
              Личный кабинет
            </Link>
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
              >
                Выйти
              </button>
            ) : null}
          </div>
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
