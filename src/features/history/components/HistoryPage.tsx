import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/shared/services/supabase';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Result {
  id: string;
  totalScore: number;
  listeningScore: number;
  readingScore: number;
  totalCorrect: number;
  timeTaken: number;
  completedAt: string;
  tests: { title: string };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m} min`;
}

function getScoreColor(score: number): string {
  if (score >= 800) return 'text-green-600 dark:text-green-400';
  if (score >= 600) return 'text-blue-600 dark:text-blue-400';
  if (score >= 400) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

export function HistoryPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/results`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setResults(data.data);
      setIsLoading(false);
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

  const avgTotal = results.length
    ? Math.round(results.reduce((s, r) => s + r.totalScore, 0) / results.length)
    : 0;
  const bestScore = results.length ? Math.max(...results.map((r) => r.totalScore)) : 0;
  const avgCorrect = results.length
    ? Math.round(results.reduce((s, r) => s + r.totalCorrect, 0) / results.length)
    : 0;

  const chartData = [...results].reverse().map((r, i) => ({
    name: `Test ${i + 1}`,
    Total: r.totalScore,
    Listening: r.listeningScore,
    Reading: r.readingScore,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mon historique</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Suivez votre progression au fil du temps
        </p>
      </div>

      {results.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-16 text-center">
          <p className="text-5xl mb-4">📊</p>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Aucun test complété pour l'instant.
          </p>
          <button
            onClick={() => navigate('/tests')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            Commencer un test →
          </button>
        </div>
      ) : (
        <>
          {/* Stats globales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Tests complétés', value: results.length, icon: '📝' },
              { label: 'Score moyen', value: avgTotal, icon: '📈' },
              { label: 'Meilleur score', value: bestScore, icon: '🏆' },
              { label: 'Moy. bonnes réponses', value: `${avgCorrect}/200`, icon: '✅' },
            ].map((s) => (
              <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 text-center">
                <span className="text-2xl">{s.icon}</span>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{s.value}</div>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Graphique */}
          {results.length > 1 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Progression des scores
              </h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 990]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#f9fafb',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="Total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Listening" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="Reading" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Liste des résultats */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Tous les tests
            </h2>
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => navigate(`/results/${r.id}`)}
                className="w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:shadow-md transition-shadow text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {r.tests?.title ?? 'Test TOEIC'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>📅 {formatDate(r.completedAt)}</span>
                      <span>⏱ {formatDuration(r.timeTaken)}</span>
                      <span>✅ {r.totalCorrect}/200</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${getScoreColor(r.totalScore)}`}>
                      {r.totalScore}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      L: {r.listeningScore} · R: {r.readingScore}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}