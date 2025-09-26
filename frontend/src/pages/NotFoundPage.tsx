import { Link } from 'react-router-dom';

const NotFoundPage = () => {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 rounded-2xl bg-white/80 px-4 py-12 text-center shadow-sm backdrop-blur-sm">
            <div>
                <h1 className="text-5xl font-black text-gray-900 sm:text-6xl">404</h1>
                <p className="mt-3 text-lg text-gray-600 sm:text-xl">Страница не найдена или была перемещена</p>
            </div>
            <Link
                to="/"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
                На главную
            </Link>
        </div>
    );
};

export default NotFoundPage;
