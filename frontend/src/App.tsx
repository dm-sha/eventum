import { AppRouter } from './router/AppRouter';
import { AuthProvider } from './contexts/AuthContext';
import { Analytics } from '@vercel/analytics/react';

function App() {
    return (
        <AuthProvider>
            <AppRouter />
            <Analytics />
        </AuthProvider>
    );
}

export default App;