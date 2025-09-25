import { Link } from "react-router-dom";

interface HeaderProps {
  variant?: 'default' | 'admin';
  className?: string;
}

const Header = ({ variant = 'default', className = '' }: HeaderProps) => {
  const isAdmin = variant === 'admin';
  
  if (isAdmin) {
    return (
      <header className={`h-14 bg-white border-b border-gray-200 sticky top-0 z-40 ${className}`}>
        <div className="h-full px-6 flex items-center">
          <Link
            to="/"
            className="text-xl font-medium text-gray-900 hover:text-gray-700"
          >
            Eventum
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className={`bg-white border-b border-gray-200 ${className}`}>
      <nav className="px-6 py-4">
        <Link
          to="/"
          className="text-xl font-medium text-gray-900 hover:text-gray-700"
        >
          Eventum
        </Link>
      </nav>
    </header>
  );
};

export default Header;
