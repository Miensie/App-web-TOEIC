import { HashRouter } from 'react-router-dom';
import { AppRouter } from './app/router/AppRouter';
import { AuthProvider } from './app/providers/AuthProvider';
import { ThemeProvider } from './app/providers/ThemeProvider';

console.log('App démarré');
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);

export default function App() {
  console.log('App render');
  return (
    <HashRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ThemeProvider>
    </HashRouter>
  );
}