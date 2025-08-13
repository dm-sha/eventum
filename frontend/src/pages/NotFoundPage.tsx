import { Link } from 'react-router-dom';

const NotFoundPage = () => {
    return (
        <div className="text-center">
            <h1 className="text-6xl font-bold text-red-500">404</h1>
            <p className="text-2xl mt-4">Страница не найдена</p>
            <Link
                to="/"
                className="mt-8 inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
                На главную
            </Link>
        </div>
    );
};

export default NotFoundPage;
