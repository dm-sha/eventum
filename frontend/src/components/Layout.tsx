import { Link, Outlet } from "react-router-dom";

const Layout = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <nav className="max-w-6xl mx-auto px-6 py-4">
          <Link
            to="/"
            className="text-xl font-medium text-gray-900 hover:text-gray-700"
          >
            Eventum
          </Link>
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
