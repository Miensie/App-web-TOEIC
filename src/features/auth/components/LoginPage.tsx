import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { Input } from '@/shared/components/ui/Input';

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Impossible de se connecter');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connexion</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Accédez à votre espace TOEIC.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <Input
            type="email"
            label="Adresse e-mail"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            type="password"
            label="Mot de passe"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Link to="/forgot-password" className="text-primary-600 hover:underline dark:text-primary-400">Mot de passe oublié ?</Link>
          <span>Pas encore de compte ? <Link to="/register" className="text-primary-600 hover:underline dark:text-primary-400">Créer un compte</Link></span>
        </div>
      </div>
    </div>
  );
}
