import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { IconBars3, IconUser, IconLogout, IconX } from "./icons";

interface HeaderProps {
  variant?: 'default' | 'admin';
  className?: string;
  showUserInfo?: boolean;
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
  showMenuToggle?: boolean;
}

const Header = ({
  variant = 'default',
  className = '',
  showUserInfo = true,
  onMenuToggle,
  isMenuOpen = false,
  showMenuToggle = false,
}: HeaderProps) => {
  const { user, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAdmin = variant === 'admin';

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const UserMenu = () => {
    if (!showUserInfo || !user) return null;

    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name}
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
              <IconUser size={16} className="text-gray-600" />
            </div>
          )}
          <IconBars3 size={16} className="text-gray-500" />
        </button>

        {isUserMenuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
            <div className="py-1">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
              </div>

              <Link
                to="/dashboard"
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                onClick={() => setIsUserMenuOpen(false)}
              >
                <IconUser size={16} className="mr-3 text-gray-400" />
                Личный кабинет
              </Link>

              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  logout();
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors"
              >
                <IconLogout size={16} className="mr-3 text-red-400" />
                Выйти
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isAdmin) {
    const shouldRenderToggle = showMenuToggle && typeof onMenuToggle === 'function';
    return (
      <header className={`h-14 bg-white border-b border-gray-200 sticky top-0 z-40 ${className}`}>
        <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {shouldRenderToggle && (
              <button
                type="button"
                onClick={onMenuToggle}
                className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 lg:hidden"
                aria-label={isMenuOpen ? 'Скрыть меню' : 'Открыть меню'}
              >
                {isMenuOpen ? <IconX size={18} /> : <IconBars3 size={18} />}
              </button>
            )}
            <Link
              to="/"
              className="text-lg font-semibold text-gray-900 hover:text-gray-700 sm:text-xl"
            >
              Eventum
            </Link>
          </div>

          <UserMenu />
        </div>
      </header>
    );
  }

  return (
    <header className={`bg-white shadow-sm border-b ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link
              to="/"
              className="text-xl font-semibold text-gray-900 hover:text-gray-700"
            >
              Eventum
            </Link>
          </div>
          
          <UserMenu />
        </div>
      </div>
    </header>
  );
};

export default Header;
