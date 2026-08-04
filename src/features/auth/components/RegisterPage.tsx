import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { Input } from '@/shared/components/ui/Input';

export function RegisterPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signUp(email, password, firstName, lastName);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Impossible de créer le compte');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inscription</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Créez votre compte pour démarrer votre préparation TOEIC.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Prénom"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
          />
          <Input
            label="Nom"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            required
          />
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
            {isSubmitting ? 'Inscription...' : 'Créer un compte'}
          </button>
        </form>

        <div className="mt-6 text-sm text-gray-600 dark:text-gray-300">
          <span>Déjà inscrit ? <Link to="/login" className="text-primary-600 hover:underline dark:text-primary-400">Se connecter</Link></span>
        </div>
      </div>
    </div>
  );
}
