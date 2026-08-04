import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { supabase } from '@/shared/services/supabase';

interface Option {
  id: string;
  label: string;
  content: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  globalIndex: number;
  orderIndex: number;
  type: string;
  stimulus: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  audioStart: number | null;
  audioEnd: number | null;
  options: Option[];
}

interface Part {
  id: string;
  number: number;
  section: string;
  title: string;
  description: string | null;
  audioUrl: string | null;
  questions: Question[];
}

interface ExamAnswer {
  questionId: string;
  optionId: string | null;
  isMarked: boolean;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ExamPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [parts, setParts] = useState<Part[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(7200);
  const [answers, setAnswers] = useState<Record<string, ExamAnswer>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Charger le token Supabase
  async function getToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? '';
  }

  // Chargement initial
  useEffect(() => {
    if (!testId || !user) return;

    async function init() {
      try {
        const token = await getToken();

        // Charger le test
        const testRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/tests/${testId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const testData = await testRes.json();
        if (!testData.success) { setError('Test introuvable'); return; }

        const sortedParts = testData.data.parts.map((p: Part) => ({
          ...p,
          questions: [...p.questions].sort((a, b) => a.globalIndex - b.globalIndex),
        })).sort((a: Part, b: Part) => a.number - b.number);

        setParts(sortedParts);

        // Créer ou récupérer la session
        const sessionRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/sessions`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ testId }),
          }
        );
        const sessionData = await sessionRes.json();
        if (!sessionData.success) { setError('Erreur création session'); return; }

        const session = sessionData.data;
        setSessionId(session.id);
        setCurrentQuestion(session.currentQuestion ?? 1);
        setTimeRemaining(session.timeRemaining ?? testData.data.totalTime);

        // Restaurer les réponses sauvegardées
        if (session.answers?.length > 0) {
          const restored: Record<string, ExamAnswer> = {};
          session.answers.forEach((a: ExamAnswer) => {
            restored[a.questionId] = a;
          });
          setAnswers(restored);
        }
      } catch {
        setError('Erreur lors du chargement');
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [testId, user]);

  // Timer
  useEffect(() => {
    if (isLoading || timeRemaining <= 0) return;
    const interval = setInterval(() => {
      setTimeRemaining((t) => {
        if (t <= 1) { handleSubmit(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Auto-save
  const saveProgress = useCallback(async () => {
    if (!sessionId) return;
    try {
      const token = await getToken();
      await fetch(`${import.meta.env.VITE_API_URL}/api/sessions/${sessionId}/progress`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentQuestion,
          timeRemaining,
          answers: Object.values(answers),
        }),
      });
    } catch { /* silencieux */ }
  }, [sessionId, currentQuestion, timeRemaining, answers]);

  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(saveProgress, 3000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [saveProgress]);

  // Toutes les questions aplaties
  const allQuestions = parts.flatMap((p) => p.questions);
  const currentQ = allQuestions.find((q) => q.globalIndex === currentQuestion);
  const currentPart = parts.find((p) => p.questions.some((q) => q.id === currentQ?.id));

  function setAnswer(questionId: string, optionId: string | null) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { questionId, optionId, isMarked: prev[questionId]?.isMarked ?? false },
    }));
  }

  function toggleMark(questionId: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        questionId,
        optionId: prev[questionId]?.optionId ?? null,
        isMarked: !prev[questionId]?.isMarked,
      },
    }));
  }

  async function handleSubmit() {
    if (!sessionId || isSubmitting) return;
    setIsSubmitting(true);
    await saveProgress();
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/sessions/${sessionId}/submit`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeRemaining }),
        }
      );
      const data = await res.json();
      if (data.success) navigate(`/results/${data.data.id}`);
      else setError('Erreur lors de la soumission');
    } catch {
      setError('Erreur lors de la soumission');
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          <p className="text-gray-600 dark:text-gray-400">Chargement du test...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-center space-y-4">
          <p className="text-red-600">{error}</p>
          <button onClick={() => navigate('/tests')} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Retour aux tests
          </button>
        </div>
      </div>
    );
  }

  const answeredCount = Object.values(answers).filter((a) => a.optionId).length;
  const isUrgent = timeRemaining <= 300;
  const isWarning = timeRemaining <= 900;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">

      {/* ── Panneau latéral ── */}
      <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
        {/* Timer + progression */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3">
          <p className="text-xs font-semibold text-gray-500 truncate">{parts[0]?.title ?? 'Test TOEIC'}</p>

          {/* Timer */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg font-mono font-bold text-lg ${
            isUrgent ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
            : isWarning ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}>
            <span>⏱</span>
            <span>{formatTime(timeRemaining)}</span>
          </div>

          {/* Barre de progression */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Q{currentQuestion} / {allQuestions.length}</span>
              <span>{answeredCount} répondues</span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
              <div
                className="h-full bg-blue-600 rounded-full transition-all"
                style={{ width: `${(currentQuestion / allQuestions.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Grille de navigation */}
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Navigation</p>
          <div className="grid grid-cols-5 gap-1">
            {allQuestions.map((q) => {
              const ans = answers[q.id];
              const isAnswered = !!ans?.optionId;
              const isMarked = !!ans?.isMarked;
              const isCurrent = currentQuestion === q.globalIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestion(q.globalIndex)}
                  className={`aspect-square text-xs font-medium rounded transition-all ${
                    isCurrent ? 'ring-2 ring-blue-600 ring-offset-1' : ''
                  } ${
                    isMarked ? 'bg-yellow-400 text-yellow-900'
                    : isAnswered ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {q.globalIndex}
                </button>
              );
            })}
          </div>

          {/* Légende */}
          <div className="mt-3 space-y-1 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-blue-600 inline-block" /> Répondu
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-yellow-400 inline-block" /> Marqué
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-gray-200 dark:bg-gray-700 inline-block" /> Non répondu
            </div>
          </div>
        </div>

        {/* Bouton soumettre */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={isSubmitting}
            className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Soumettre le test
          </button>
        </div>
      </aside>

      {/* ── Zone principale ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

          {/* En-tête partie */}
          {currentPart && (
            <div className="bg-blue-600 text-white rounded-xl p-4">
              <div className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">
                {currentPart.section === 'LISTENING' ? '🎧 Listening' : '📖 Reading'} — Part {currentPart.number}
              </div>
              <h2 className="text-lg font-bold">{currentPart.title}</h2>
              {currentPart.description && (
                <p className="text-sm opacity-80 mt-1">{currentPart.description}</p>
              )}
            </div>
          )}

          {/* Audio */}
          {currentPart?.audioUrl && (
            <div className="bg-gray-900 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-2">🎧 Audio — Part {currentPart.number}</p>
              <audio
                controls
                src={currentPart.audioUrl}
                className="w-full"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          )}

          {/* Question */}
          {currentQ && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Question {currentQ.globalIndex}
                </span>
                <button
                  onClick={() => toggleMark(currentQ.id)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1 rounded-lg transition-colors ${
                    answers[currentQ.id]?.isMarked
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {answers[currentQ.id]?.isMarked ? '🚩 Marquée' : '⚑ Marquer'}
                </button>
              </div>

              {/* Image */}
              {currentQ.imageUrl && (
                <div className="flex justify-center">
                  <img
                    src={currentQ.imageUrl}
                    alt="Question"
                    className="max-h-64 object-contain rounded-lg border border-gray-200 dark:border-gray-700"
                  />
                </div>
              )}

              {/* Stimulus */}
              {currentQ.stimulus && (
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {currentQ.stimulus}
                </div>
              )}

              {/* Options */}
              <div className="space-y-3">
                {currentQ.options.map((option) => {
                  const isSelected = answers[currentQ.id]?.optionId === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setAnswer(currentQ.id, isSelected ? null : option.id)}
                      className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900'
                      }`}
                    >
                      <span className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                      }`}>
                        {option.label}
                      </span>
                      <span className="text-sm text-gray-800 dark:text-gray-200 pt-0.5">
                        {option.content}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setCurrentQuestion((q) => Math.max(1, q - 1))}
              disabled={currentQuestion <= 1}
              className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
            >
              ← Précédente
            </button>
            <span className="text-sm text-gray-500">{currentQuestion} / {allQuestions.length}</span>
            <button
              onClick={() => {
                if (currentQuestion === allQuestions.length) setShowConfirm(true);
                else setCurrentQuestion((q) => Math.min(allQuestions.length, q + 1));
              }}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {currentQuestion === allQuestions.length ? 'Terminer →' : 'Suivante →'}
            </button>
          </div>
        </div>
      </main>

      {/* ── Modal confirmation ── */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 max-w-md w-full space-y-5 shadow-xl">
            <div className="text-center space-y-2">
              <span className="text-4xl">📋</span>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Soumettre le test ?</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Vous avez répondu à <strong>{answeredCount}</strong> questions sur {allQuestions.length}.
                {allQuestions.length - answeredCount > 0 && (
                  <span className="text-yellow-600 dark:text-yellow-400">
                    {' '}{allQuestions.length - answeredCount} sans réponse.
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium transition-colors"
              >
                Continuer
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {isSubmitting ? 'Envoi...' : 'Soumettre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}