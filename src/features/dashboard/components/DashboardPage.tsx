import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { supabase } from '@/shared/services/supabase';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';

interface Result {
  id: string;
  totalScore: number;
  listeningScore: number;
  readingScore: number;
  totalCorrect: number;
  listeningCorrect: number;
  readingCorrect: number;
  timeTaken: number;
  completedAt: string;
  tests: { title: string };
}

interface TestSummary {
  id: string;
  title: string;
  description: string | null;
  totalTime: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
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

function getScoreBg(score: number): string {
  if (score >= 800) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (score >= 600) return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
  if (score >= 400) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function getLevel(score: number): string {
  if (score >= 860) return 'C1 — Autonome avancé';
  if (score >= 730) return 'B2 — Indépendant avancé';
  if (score >= 600) return 'B1 — Indépendant';
  if (score >= 470) return 'A2 — Élémentaire avancé';
  if (score >= 300) return 'A1 — Élémentaire';
  return 'Débutant';
}

export function DashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<Result[]>([]);
  const [availableTests, setAvailableTests] = useState<TestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const headers = { Authorization: `Bearer ${token}` };
      const apiUrl = import.meta.env.VITE_API_URL;

      const [resultsRes, testsRes] = await Promise.all([
        fetch(`${apiUrl}/api/results`, { headers }).then((r) => r.json()),
        fetch(`${apiUrl}/api/tests`, { headers }).then((r) => r.json()),
      ]);

      if (resultsRes.success) setResults(resultsRes.data);
      if (testsRes.success) setAvailableTests(testsRes.data);
      setIsLoading(false);
    }
    load();
  }, []);

  // Calculs statistiques
  const totalTests = results.length;
  const bestScore = totalTests ? Math.max(...results.map((r) => r.totalScore)) : 0;
  const avgScore = totalTests
    ? Math.round(results.reduce((s, r) => s + r.totalScore, 0) / totalTests)
    : 0;
  const lastResult = results[0] ?? null;
  const avgListening = totalTests
    ? Math.round(results.reduce((s, r) => s + r.listeningCorrect, 0) / totalTests)
    : 0;
  const avgReading = totalTests
    ? Math.round(results.reduce((s, r) => s + r.readingCorrect, 0) / totalTests)
    : 0;

  // Progression (dernier vs avant-dernier)
  const progression = results.length >= 2
    ? results[0].totalScore - results[1].totalScore
    : null;

  // Données radar
  const radarData = [
    { subject: 'Listening', value: avgListening, fullMark: 100 },
    { subject: 'Reading', value: avgReading, fullMark: 100 },
    { subject: 'Score L', value: totalTests ? Math.round(results.reduce((s, r) => s + r.listeningScore, 0) / totalTests / 4.95) : 0, fullMark: 100 },
    { subject: 'Score R', value: totalTests ? Math.round(results.reduce((s, r) => s + r.readingScore, 0) / totalTests / 4.95) : 0, fullMark: 100 },
    { subject: 'Global', value: totalTests ? Math.round(avgScore / 9.9) : 0, fullMark: 100 },
  ];

  // Tests non encore faits
  const doneTestIds = new Set(results.map((r: any) => r.testId));
  const newTests = availableTests.filter((t) => !doneTestIds.has(t.id));

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Bonjour{profile?.firstName ? `, ${profile.firstName}` : ''} 👋
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {totalTests === 0
            ? 'Commencez votre premier test pour voir vos statistiques ici.'
            : `Vous avez complété ${totalTests} test${totalTests > 1 ? 's' : ''}. Continuez comme ça !`}
        </p>
      </div>

      {totalTests === 0 ? (
        /* ── État vide ── */
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-12 text-center space-y-4">
            <span className="text-6xl">🎯</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Prêt pour votre premier test TOEIC ?
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm max-w-md mx-auto">
              Passez un test complet de 200 questions dans les mêmes conditions que le vrai examen.
            </p>
            <button
              onClick={() => navigate('/tests')}
              className="px-8 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              Voir les tests disponibles →
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Stats principales ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Tests complétés', value: totalTests, icon: '📝', sub: '' },
              { label: 'Score moyen', value: avgScore, icon: '📈', sub: getLevel(avgScore) },
              { label: 'Meilleur score', value: bestScore, icon: '🏆', sub: getLevel(bestScore) },
              {
                label: 'Progression',
                value: progression !== null
                  ? `${progression > 0 ? '+' : ''}${progression}`
                  : '—',
                icon: progression !== null && progression > 0 ? '📈' : '📉',
                sub: progression !== null ? 'par rapport au test précédent' : 'Passez plus de tests',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5"
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{s.icon}</span>
                </div>
                <div className={`text-3xl font-bold mt-2 ${
                  s.label === 'Score moyen' ? getScoreColor(avgScore)
                  : s.label === 'Meilleur score' ? getScoreColor(bestScore)
                  : s.label === 'Progression' && progression !== null
                    ? progression > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-white'
                }`}>
                  {s.value}
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-tight">{s.label}</p>
                {s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ── Dernier résultat ── */}
            {lastResult && (
              <div
                className={`rounded-xl border p-6 cursor-pointer hover:shadow-md transition-shadow ${getScoreBg(lastResult.totalScore)}`}
                onClick={() => navigate(`/results/${lastResult.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Dernier test
                    </p>
                    <p className="font-semibold text-gray-900 dark:text-white mt-1 text-sm">
                      {lastResult.tests?.title}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(lastResult.completedAt)}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-4xl font-bold ${getScoreColor(lastResult.totalScore)}`}>
                      {lastResult.totalScore}
                    </div>
                    <p className="text-xs text-gray-500">/ 990</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white/60 dark:bg-gray-900/40 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">🎧 Listening</p>
                    <p className="font-bold text-gray-900 dark:text-white">{lastResult.listeningScore}</p>
                    <p className="text-xs text-gray-400">{lastResult.listeningCorrect}/100</p>
                  </div>
                  <div className="bg-white/60 dark:bg-gray-900/40 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">📖 Reading</p>
                    <p className="font-bold text-gray-900 dark:text-white">{lastResult.readingScore}</p>
                    <p className="text-xs text-gray-400">{lastResult.readingCorrect}/100</p>
                  </div>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-3 text-right">
                  Voir les corrections →
                </p>
              </div>
            )}

            {/* ── Radar des performances ── */}
            {totalTests > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Profil de performance
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <Radar
                      name="Moyenne"
                      dataKey="value"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.3}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Sections L/R détaillées ── */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Analyse par section (moyenne sur {totalTests} test{totalTests > 1 ? 's' : ''})
            </h2>
            <div className="space-y-4">
              {[
                { label: '🎧 Listening', correct: avgListening, score: totalTests ? Math.round(results.reduce((s, r) => s + r.listeningScore, 0) / totalTests) : 0, color: 'bg-blue-600' },
                { label: '📖 Reading', correct: avgReading, score: totalTests ? Math.round(results.reduce((s, r) => s + r.readingScore, 0) / totalTests) : 0, color: 'bg-green-600' },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{s.label}</span>
                    <span className="text-gray-500">{s.correct}/100 bonnes réponses · Score {s.score}/495</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${s.color} rounded-full transition-all`}
                      style={{ width: `${s.correct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Tests disponibles ── */}
          {newTests.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Tests non encore effectués
                </h2>
                <button
                  onClick={() => navigate('/tests')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Voir tous →
                </button>
              </div>
              <div className="space-y-2">
                {newTests.slice(0, 3).map((test) => (
                  <div
                    key={test.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    onClick={() => navigate(`/tests/${test.id}/exam`)}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{test.title}</p>
                      {test.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{test.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">⏱ {formatDuration(test.totalTime)}</span>
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Commencer →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Historique rapide ── */}
          {results.length > 1 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Tests récents
                </h2>
                <button
                  onClick={() => navigate('/history')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Voir tout →
                </button>
              </div>
              <div className="space-y-2">
                {results.slice(0, 4).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    onClick={() => navigate(`/results/${r.id}`)}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {r.tests?.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(r.completedAt)} · {formatDuration(r.timeTaken)}
                      </p>
                    </div>
                    <div className={`text-xl font-bold ${getScoreColor(r.totalScore)}`}>
                      {r.totalScore}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}