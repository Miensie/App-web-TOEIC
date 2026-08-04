import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/shared/services/supabase';

interface QuestionResult {
  id: string;
  questionId: string;
  selectedLabel: string | null;
  correctLabel: string;
  isCorrect: boolean;
  questions: {
    globalIndex: number;
    stimulus: string | null;
    options: { label: string; content: string; explanation: string | null }[];
    parts: { number: number; section: string; title: string };
  };
}

interface Result {
  id: string;
  listeningScore: number;
  readingScore: number;
  totalScore: number;
  listeningCorrect: number;
  readingCorrect: number;
  totalCorrect: number;
  timeTaken: number;
  completedAt: string;
  tests: { title: string };
  question_results: QuestionResult[];
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}min`;
  return `${m}min${String(s).padStart(2, '0')}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function ResultPage() {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<Result | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'wrong'>('all');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/results/${resultId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success) setResult(data.data);
      setIsLoading(false);
    }
    load();
  }, [resultId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Résultat introuvable.</p>
        <button onClick={() => navigate('/history')} className="mt-4 text-blue-600 hover:underline text-sm">
          Voir l'historique
        </button>
      </div>
    );
  }

  const listeningPct = Math.round((result.listeningCorrect / 100) * 100);
  const readingPct = Math.round((result.readingCorrect / 100) * 100);
  const filtered = filter === 'wrong'
    ? result.question_results.filter((qr) => !qr.isCorrect)
    : result.question_results;

  // Score niveau
  function getLevel(score: number): { label: string; color: string } {
    if (score >= 800) return { label: 'Excellent', color: 'text-green-600' };
    if (score >= 600) return { label: 'Bon niveau', color: 'text-blue-600' };
    if (score >= 400) return { label: 'Intermédiaire', color: 'text-yellow-600' };
    return { label: 'Débutant', color: 'text-red-600' };
  }

  const level = getLevel(result.totalScore);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">

      {/* Score principal */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-center space-y-3">
        <p className="text-sm text-gray-500">{result.tests?.title} — {formatDate(result.completedAt)}</p>
        <div className="text-7xl font-bold text-gray-900 dark:text-white">{result.totalScore}</div>
        <p className="text-gray-500">Score total TOEIC <span className="font-medium">(sur 990)</span></p>
        <span className={`text-lg font-semibold ${level.color}`}>{level.label}</span>
      </div>

      {/* Scores L/R */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Listening', score: result.listeningScore, correct: result.listeningCorrect, pct: listeningPct, icon: '🎧', color: 'bg-blue-600' },
          { label: 'Reading', score: result.readingScore, correct: result.readingCorrect, pct: readingPct, icon: '📖', color: 'bg-green-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-center space-y-3">
            <span className="text-3xl">{s.icon}</span>
            <div className="text-4xl font-bold text-gray-900 dark:text-white">{s.score}</div>
            <p className="text-sm text-gray-500">{s.label} <span className="text-xs">(sur 495)</span></p>
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${s.pct}%` }} />
            </div>
            <p className="text-xs text-gray-400">{s.correct}/100 bonnes réponses ({s.pct}%)</p>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-700 text-center">
          <div className="px-4">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{result.totalCorrect}</div>
            <p className="text-xs text-gray-500 mt-1">Bonnes réponses</p>
          </div>
          <div className="px-4">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{200 - result.totalCorrect}</div>
            <p className="text-xs text-gray-500 mt-1">Erreurs</p>
          </div>
          <div className="px-4">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatDuration(result.timeTaken)}</div>
            <p className="text-xs text-gray-500 mt-1">Temps utilisé</p>
          </div>
        </div>
      </div>

      {/* Corrections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Corrections détaillées</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              Toutes ({result.question_results.length})
            </button>
            <button
              onClick={() => setFilter('wrong')}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                filter === 'wrong' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              Erreurs ({result.question_results.filter((q) => !q.isCorrect).length})
            </button>
          </div>
        </div>

        {filtered.map((qr) => (
          <div key={qr.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                qr.isCorrect
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {qr.isCorrect ? '✓' : '✗'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-gray-500">
                    Q{qr.questions?.globalIndex} — {qr.questions?.parts?.title}
                  </span>
                  {!qr.isCorrect && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                      Votre réponse : {qr.selectedLabel ?? 'Aucune'}
                    </span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                    Bonne réponse : {qr.correctLabel}
                  </span>
                </div>

                {qr.questions?.stimulus && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-3 italic">
                    {qr.questions.stimulus}
                  </p>
                )}

                <div className="grid grid-cols-1 gap-1">
                  {qr.questions?.options?.map((opt) => (
                    <div key={opt.label} className={`text-xs px-3 py-1.5 rounded-lg flex items-start gap-2 ${
                      opt.label === qr.correctLabel
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 font-medium'
                        : opt.label === qr.selectedLabel
                        ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        : 'text-gray-500 dark:text-gray-500'
                    }`}>
                      <span className="font-bold flex-shrink-0">{opt.label}.</span>
                      <span>{opt.content}</span>
                      {opt.explanation && opt.label === qr.correctLabel && (
                        <span className="text-gray-400 ml-1">— {opt.explanation}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-4 justify-center pb-8">
        <button
          onClick={() => navigate('/tests')}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium transition-colors"
        >
          ← Retour aux tests
        </button>
        <button
          onClick={() => navigate('/history')}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          Voir mon historique →
        </button>
      </div>
    </div>
  );
}