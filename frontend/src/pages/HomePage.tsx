import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllEventums } from '../api/eventum';
import type { Eventum } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const HomePage = () => {
    const [eventums, setEventums] = useState<Eventum[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchEventums = async () => {
            try {
                setLoading(true);
                const data = await getAllEventums();
                setEventums(data);
            } catch (err) {
                setError(
                    'Не удалось загрузить мероприятия. Убедитесь, что бэкенд запущен.'
                );
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchEventums();
    }, []);

    if (loading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return <p className="text-center text-red-600 p-4">{error}</p>;
    }

    return (
        <main className="min-h-screen p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Event Management System</h1>

                <div className="mb-8">
                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">All Eventums</h2>
                    {eventums.length === 0 ? (
                        <p className="text-gray-600">No eventums found.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {eventums.map((eventum) => (
                                <Link
                                    to={`/${eventum.slug}`}
                                    className="block p-6 bg-white rounded-lg border border-gray-200 shadow-md hover:bg-gray-50 transition-colors"
                                >
                                    <h3 className="text-xl font-semibold text-gray-800">{eventum.name}</h3>
                                    {/* <p className="mt-2 text-gray-600">Slug: {eventum.slug}</p> */}
                                    <div className="mt-4 text-blue-600 hover:text-blue-800 font-medium">
                                        View details →
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
};

export default HomePage;
