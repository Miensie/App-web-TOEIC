import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { Input } from '@/shared/components/ui/Input';

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      await resetPassword(email);
      setMessage('Un lien de réinitialisation a été envoyé à votre e-mail.');
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Impossible d’envoyer le lien de réinitialisation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Réinitialiser le mot de passe</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Entrez votre adresse e-mail pour recevoir un lien de récupération.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <Input
            type="email"
            label="Adresse e-mail"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          {error && <p className="text-sm text-red-500">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Envoi...' : 'Envoyer le lien'}
          </button>
        </form>

        <div className="mt-6 text-sm text-gray-600 dark:text-gray-300">
          <Link to="/login" className="text-primary-600 hover:underline dark:text-primary-400">Retour à la connexion</Link>
        </div>
      </div>
    </div>
  );
}
