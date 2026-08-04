import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/shared/services/supabase';

interface TestSummary {
  id: string;
  title: string;
  description: string | null;
  version: string;
  totalTime: number;
  createdAt: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m} min`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function TestsListPage() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? '';

        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/tests`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();

        if (data.success) setTests(data.data);
        else setError('Impossible de charger les tests.');
      } catch {
        setError('Impossible de charger les tests.');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tests TOEIC</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Choisissez un test pour commencer votre entraînement
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {tests.length === 0 && !error ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-16 text-center">
          <p className="text-5xl mb-4">📭</p>
          <p className="text-gray-600 dark:text-gray-400">
            Aucun test disponible pour le moment.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Les tests doivent être publiés par un administrateur.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tests.map((test) => (
            <div
              key={test.id}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    v{test.version}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{test.title}</h3>
                {test.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {test.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>⏱ {formatDuration(test.totalTime)}</span>
                  <span>📅 {formatDate(test.createdAt)}</span>
                  <span>📝 200 questions</span>
                </div>
              </div>
              <button
                onClick={() => navigate(`/tests/${test.id}/exam`)}
                className="w-full mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Commencer le test
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}