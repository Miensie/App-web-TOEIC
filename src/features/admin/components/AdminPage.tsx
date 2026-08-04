import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/shared/services/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OptionForm {
  label: string;
  content: string;
  isCorrect: boolean;
  explanation: string;
}

interface QuestionForm {
  id?: string;          // id Supabase si déjà sauvegardé
  orderIndex: number;
  globalIndex: number;
  type: string;
  stimulus: string;
  imageUrl: string;
  audioUrl: string;
  audioStart: string;
  audioEnd: string;
  options: OptionForm[];
  isSaved: boolean;
}

interface PartForm {
  id?: string;          // id Supabase si déjà sauvegardé
  number: number;
  section: 'LISTENING' | 'READING';
  title: string;
  description: string;
  audioUrl: string;
  questions: QuestionForm[];
}

interface TestDraft {
  id: string;           // id Supabase — toujours présent après création
  title: string;
  description: string;
  version: string;
  status: string;
  parts: PartForm[];
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PART_CONFIGS = [
  { number: 1, section: 'LISTENING' as const, title: 'Photographs',           type: 'PHOTO_DESCRIPTION',     count: 6,  globalStart: 1   },
  { number: 2, section: 'LISTENING' as const, title: 'Question-Response',      type: 'QUESTION_RESPONSE',     count: 25, globalStart: 7   },
  { number: 3, section: 'LISTENING' as const, title: 'Conversations',          type: 'CONVERSATION',          count: 39, globalStart: 32  },
  { number: 4, section: 'LISTENING' as const, title: 'Short Talks',            type: 'SHORT_TALK',            count: 30, globalStart: 71  },
  { number: 5, section: 'READING'   as const, title: 'Incomplete Sentences',   type: 'INCOMPLETE_SENTENCE',   count: 30, globalStart: 101 },
  { number: 6, section: 'READING'   as const, title: 'Text Completion',        type: 'TEXT_COMPLETION',       count: 16, globalStart: 131 },
  { number: 7, section: 'READING'   as const, title: 'Reading Comprehension',  type: 'READING_COMPREHENSION', count: 54, globalStart: 147 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOptions(): OptionForm[] {
  return ['A', 'B', 'C', 'D'].map((label) => ({
    label, content: '', isCorrect: false, explanation: '',
  }));
}

function makeQuestion(orderIndex: number, globalIndex: number, type: string): QuestionForm {
  return {
    orderIndex, globalIndex, type,
    stimulus: '', imageUrl: '', audioUrl: '',
    audioStart: '', audioEnd: '',
    options: makeOptions(),
    isSaved: false,
  };
}

function makeParts(): PartForm[] {
  return PART_CONFIGS.map((cfg) => ({
    number: cfg.number, section: cfg.section,
    title: cfg.title, description: '', audioUrl: '',
    questions: Array.from({ length: cfg.count }, (_, i) =>
      makeQuestion(i + 1, cfg.globalStart + i, cfg.type)
    ),
  }));
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  return res.json();
}

// ─── Composant principal ───────────────────────────────────────────────────────

export function AdminPage() {
  const [view, setView] = useState<'list' | 'edit' | 'manage'>('list');
  const [drafts, setDrafts] = useState<{ id: string; title: string; status: string; version: string }[]>([]);
  const [draft, setDraft] = useState<TestDraft | null>(null);
  const [activePart, setActivePart] = useState(0);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [newTestTitle, setNewTestTitle] = useState('');
  const [newTestVersion, setNewTestVersion] = useState('1.0');
  const [isCreating, setIsCreating] = useState(false);

  // Charger la liste des tests existants
  useEffect(() => {
    if (view === 'list' || view === 'manage') loadDrafts();
  }, [view]);

  async function loadDrafts() {
    const data = await apiFetch('/api/tests');
    // Charger aussi les drafts via admin
    const adminData = await apiFetch('/api/admin/tests/all');
    if (adminData.success) setDrafts(adminData.data);
    else if (data.success) setDrafts(data.data);
  }

// Dans AdminPage.tsx, ajoute cet état et ce formulaire en haut de la vue 'list'

const [pdfImport, setPdfImport] = useState({
  title: '',
  listening: null as File | null,
  reading: null as File | null,
  answers: null as File | null,
  audio: null as File | null,
});
const [isImportingPdf, setIsImportingPdf] = useState(false);
const [importProgress, setImportProgress] = useState('');
const [importResult, setImportResult] = useState<any>(null);

async function handlePdfImport() {
  if (!pdfImport.title || !pdfImport.listening || !pdfImport.reading || !pdfImport.answers) {
    alert('Le titre et les 3 PDFs sont requis.');
    return;
  }

  setIsImportingPdf(true);
  setImportProgress('📄 Extraction du texte des PDFs...');
  setImportResult(null);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';

    const formData = new FormData();
    formData.append('title', pdfImport.title);
    formData.append('listening', pdfImport.listening);
    formData.append('reading', pdfImport.reading);
    formData.append('answers', pdfImport.answers);

    setImportProgress('🤖 Claude analyse les questions (30-60 secondes)...');

    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/tests/import-pdf`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await res.json();

    if (data.success) {
      setImportProgress('');
      setImportResult(data.data);

      // Upload audio si fourni
      if (pdfImport.audio && data.data.testId) {
        setImportProgress('🎵 Upload de l\'audio...');
        const audioPath = `audios/test-${data.data.testId}/full-audio.mp3`;
        await supabase.storage.from('toeic-assets').upload(audioPath, pdfImport.audio, { upsert: true });
        const { data: urlData } = supabase.storage.from('toeic-assets').getPublicUrl(audioPath);

        // Mettre à jour les parties Listening avec l'URL audio
        setImportProgress('🔗 Association de l\'audio aux parties...');
        const { data: partsData } = await supabase
          .from('parts')
          .select('id')
          .eq('testId', data.data.testId)
          .eq('section', 'LISTENING');

        if (partsData) {
          for (const part of partsData) {
            await supabase.from('parts').update({ audioUrl: urlData.publicUrl }).eq('id', part.id);
          }
        }
        setImportProgress('');
      }

      loadDrafts();
      setPdfImport({ title: '', listening: null, reading: null, answers: null, audio: null });
    } else {
      setImportProgress('');
      alert(`Erreur : ${data.error}`);
    }
  } catch (err) {
    setImportProgress('');
    alert('Erreur réseau lors de l\'import');
  } finally {
    setIsImportingPdf(false);
  }
}

  // ── Ouvrir un test existant pour l'éditer ──
  async function openTest(id: string) {
    const data = await apiFetch(`/api/admin/tests/${id}/full`);
    if (!data.success) return;

    const serverTest = data.data;
    const parts: PartForm[] = PART_CONFIGS.map((cfg) => {
      const serverPart = serverTest.parts?.find((p: any) => p.number === cfg.number);
      const questions: QuestionForm[] = Array.from({ length: cfg.count }, (_, i) => {
        const serverQ = serverPart?.questions?.find((q: any) => q.orderIndex === i + 1);
        if (serverQ) {
          return {
            id: serverQ.id,
            orderIndex: serverQ.orderIndex,
            globalIndex: serverQ.globalIndex,
            type: serverQ.type,
            stimulus: serverQ.stimulus ?? '',
            imageUrl: serverQ.imageUrl ?? '',
            audioUrl: serverQ.audioUrl ?? '',
            audioStart: serverQ.audioStart?.toString() ?? '',
            audioEnd: serverQ.audioEnd?.toString() ?? '',
            options: ['A', 'B', 'C', 'D'].map((label) => {
              const opt = serverQ.options?.find((o: any) => o.label === label);
              return {
                label,
                content: opt?.content ?? '',
                isCorrect: opt?.isCorrect ?? false,
                explanation: opt?.explanation ?? '',
              };
            }),
            isSaved: true,
          };
        }
        return makeQuestion(i + 1, cfg.globalStart + i, cfg.type);
      });
      return {
        id: serverPart?.id,
        number: cfg.number,
        section: cfg.section,
        title: cfg.title,
        description: serverPart?.description ?? '',
        audioUrl: serverPart?.audioUrl ?? '',
        questions,
      };
    });

    setDraft({ id: serverTest.id, title: serverTest.title, description: serverTest.description ?? '', version: serverTest.version, status: serverTest.status, parts });
    setActivePart(0);
    setActiveQuestion(0);
    setView('edit');
  }

  // ── Sauvegarder la question courante ──
  const saveCurrentQuestion = useCallback(async () => {
    if (!draft) return;
    const part = draft.parts[activePart];
    const q = part.questions[activeQuestion];
    if (!part.id) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const payload = {
        partId: part.id,
        orderIndex: q.orderIndex,
        globalIndex: q.globalIndex,
        type: q.type,
        stimulus: q.stimulus || null,
        imageUrl: q.imageUrl || null,
        audioUrl: q.audioUrl || null,
        audioStart: q.audioStart ? parseFloat(q.audioStart) : null,
        audioEnd: q.audioEnd ? parseFloat(q.audioEnd) : null,
        options: q.options,
      };

      let data;
      if (q.id) {
        // Mise à jour
        data = await apiFetch(`/api/admin/questions/${q.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        // Création
        data = await apiFetch('/api/admin/questions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      if (data.success) {
        const updated = { ...draft };
        updated.parts[activePart].questions[activeQuestion] = {
          ...q,
          id: data.data.id,
          isSaved: true,
        };
        setDraft(updated);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } finally {
      setIsSaving(false);
    }
  }, [draft, activePart, activeQuestion]);

  // ── Sauvegarder et passer à la question suivante ──
  async function saveAndNext() {
    await saveCurrentQuestion();
    const part = draft!.parts[activePart];
    if (activeQuestion < part.questions.length - 1) {
      setActiveQuestion((q) => q + 1);
    } else if (activePart < draft!.parts.length - 1) {
      setActivePart((p) => p + 1);
      setActiveQuestion(0);
    }
  }

  // ── Upload fichier ──
  async function uploadFile(file: File, path: string): Promise<string | null> {
    const { error } = await supabase.storage.from('toeic-assets').upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from('toeic-assets').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handlePartAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !draft) return;
    setUploadingKey('part-audio');
    const url = await uploadFile(file, `audios/test-${draft.id}/part${activePart + 1}/${file.name}`);
    if (url) {
      const updated = { ...draft };
      updated.parts[activePart].audioUrl = url;
      setDraft(updated);
      // Sauvegarder l'URL audio de la partie
      if (updated.parts[activePart].id) {
        await apiFetch(`/api/admin/parts/${updated.parts[activePart].id}`, {
          method: 'PATCH',
          body: JSON.stringify({ audioUrl: url }),
        });
      }
    }
    setUploadingKey(null);
  }

  async function handleQuestionImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !draft) return;
    setUploadingKey('q-image');
    const q = draft.parts[activePart].questions[activeQuestion];
    const url = await uploadFile(file, `images/test-${draft.id}/part${activePart + 1}/q${q.globalIndex}/${file.name}`);
    if (url) {
      updateQuestionField('imageUrl', url);
    }
    setUploadingKey(null);
  }

  async function handleQuestionAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !draft) return;
    setUploadingKey('q-audio');
    const q = draft.parts[activePart].questions[activeQuestion];
    const url = await uploadFile(file, `audios/test-${draft.id}/part${activePart + 1}/q${q.globalIndex}/${file.name}`);
    if (url) {
      updateQuestionField('audioUrl', url);
    }
    setUploadingKey(null);
  }

  // ── Mise à jour locale ──
  function updateQuestionField(field: keyof QuestionForm, value: string) {
    if (!draft) return;
    const updated = { ...draft };
    updated.parts[activePart].questions[activeQuestion] = {
      ...updated.parts[activePart].questions[activeQuestion],
      [field]: value,
      isSaved: false,
    };
    setDraft(updated);
  }

  function updateOption(oi: number, field: keyof OptionForm, value: string | boolean) {
    if (!draft) return;
    const updated = { ...draft };
    const options = [...updated.parts[activePart].questions[activeQuestion].options];
    if (field === 'isCorrect' && value === true) {
      options.forEach((o, i) => { options[i] = { ...o, isCorrect: i === oi }; });
    } else {
      options[oi] = { ...options[oi], [field]: value };
    }
    updated.parts[activePart].questions[activeQuestion] = {
      ...updated.parts[activePart].questions[activeQuestion],
      options,
      isSaved: false,
    };
    setDraft(updated);
  }

  async function publishTest(id: string, status: 'PUBLISHED' | 'DRAFT') {
    await apiFetch(`/api/admin/tests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    loadDrafts();
    if (draft?.id === id) setDraft({ ...draft, status });
  }

  async function deleteTest(id: string, title: string) {
    if (!window.confirm(`Supprimer "${title}" ? Action irréversible.`)) return;
    await apiFetch(`/api/admin/tests/${id}`, { method: 'DELETE' });
    if (draft?.id === id) { setDraft(null); setView('list'); }
    loadDrafts();
  }


  

  // ─────────────────────────────────────────────────────────────────────────────
  // VUE : Liste des tests
  // ─────────────────────────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Administration</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">Créez et gérez vos tests TOEIC</p>
        </div>

        {/* Import IA depuis PDFs */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              🤖 Import automatique par IA
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Uploadez les 3 PDFs du test — Claude extrait et structure automatiquement toutes les questions.
            </p>
          </div>

          {importResult && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm text-green-700 dark:text-green-400">
              ✅ <strong>{importResult.questionsInserted} questions</strong> importées sur {importResult.partsInserted} parties.
              Le test est en <strong>DRAFT</strong> — cliquez Éditer pour vérifier puis Publier.
            </div>
          )}

          {importProgress && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm text-blue-700 dark:text-blue-400 flex items-center gap-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 flex-shrink-0" />
              {importProgress}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Titre du test *
              </label>
              <input
                type="text"
                value={pdfImport.title}
                onChange={(e) => setPdfImport({ ...pdfImport, title: e.target.value })}
                placeholder="ex: TOEIC Practice Test Vol. 1"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {[
              { key: 'listening', label: '📄 PDF Listening (livret)', accept: '.pdf' },
              { key: 'reading', label: '📄 PDF Reading (livret)', accept: '.pdf' },
              { key: 'answers', label: '📄 PDF Corrigés & Transcriptions', accept: '.pdf' },
              { key: 'audio', label: '🎵 Audio MP3 (optionnel)', accept: '.mp3,.m4a,.wav' },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {field.label}
                </label>
                <label className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                  pdfImport[field.key as keyof typeof pdfImport]
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                }`}>
                  <input
                    type="file"
                    accept={field.accept}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setPdfImport({ ...pdfImport, [field.key]: file });
                    }}
                  />
                  {pdfImport[field.key as keyof typeof pdfImport] ? (
                    <span className="text-xs text-green-600">
                      ✅ {(pdfImport[field.key as keyof typeof pdfImport] as File)?.name}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">Cliquez pour choisir un fichier</span>
                  )}
                </label>
              </div>
            ))}
          </div>

          <button
            onClick={handlePdfImport}
            disabled={isImportingPdf || !pdfImport.title || !pdfImport.listening || !pdfImport.reading || !pdfImport.answers}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isImportingPdf ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Import en cours...
              </>
            ) : '🚀 Importer le test avec l\'IA'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            L'import prend environ 60 secondes. Le test sera créé en DRAFT pour vérification.
          </p>
        </div>

        {/* Créer un test vide (pour saisie manuelle) */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            ✏️ Ou créer un test vide (saisie manuelle)
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newTestTitle}
              onChange={(e) => setNewTestTitle(e.target.value)}
              placeholder="Titre du test"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && createTest()}
            />
            <button
              onClick={createTest}
              disabled={isCreating || !newTestTitle.trim()}
              className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {isCreating ? '⏳' : '✨ Créer'}
            </button>
          </div>
        </div>

        {/* Tests existants */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tests existants</h2>
          {drafts.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-500 text-sm">Aucun test créé pour le moment.</p>
            </div>
          ) : (
            drafts.map((t) => (
              <div key={t.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{t.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Version {t.version}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    t.status === 'PUBLISHED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {t.status}
                  </span>
                  <button
                    onClick={() => openTest(t.id)}
                    className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    ✏️ Éditer
                  </button>
                  {t.status !== 'PUBLISHED' ? (
                    <button
                      onClick={() => publishTest(t.id, 'PUBLISHED')}
                      className="px-4 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      ✅ Publier
                    </button>
                  ) : (
                    <button
                      onClick={() => publishTest(t.id, 'DRAFT')}
                      className="px-4 py-1.5 text-xs bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                    >
                      ⏸ Masquer
                    </button>
                  )}
                  <button
                    onClick={() => deleteTest(t.id, t.title)}
                    className="px-4 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VUE : Éditeur de test
  // ─────────────────────────────────────────────────────────────────────────────

  if (!draft) return null;

  const currentPart = draft.parts[activePart];
  const currentQ = currentPart.questions[activeQuestion];
  const cfg = PART_CONFIGS[activePart];

  const savedCount = currentPart.questions.filter((q) => q.isSaved).length;
  const totalCount = currentPart.questions.length;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">

      {/* ── En-tête éditeur ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('list')}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
          >
            ← Retour
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">{draft.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                draft.status === 'PUBLISHED'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}>
                {draft.status}
              </span>
              <span className="text-xs text-gray-400">v{draft.version}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Statut de sauvegarde */}
          <span className={`text-xs font-medium ${
            saveStatus === 'saving' ? 'text-blue-500'
            : saveStatus === 'saved' ? 'text-green-500'
            : saveStatus === 'error' ? 'text-red-500'
            : 'text-gray-400'
          }`}>
            {saveStatus === 'saving' ? '⏳ Sauvegarde...'
            : saveStatus === 'saved' ? '✅ Sauvegardé'
            : saveStatus === 'error' ? '❌ Erreur'
            : ''}
          </span>

          <button
            onClick={saveCurrentQuestion}
            disabled={isSaving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            💾 Sauvegarder
          </button>

          {draft.status !== 'PUBLISHED' ? (
            <button
              onClick={() => publishTest(draft.id, 'PUBLISHED')}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              ✅ Publier
            </button>
          ) : (
            <button
              onClick={() => publishTest(draft.id, 'DRAFT')}
              className="px-4 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              ⏸ Masquer
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">

        {/* ── Sidebar parties ── */}
        <div className="col-span-12 md:col-span-3">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden sticky top-4">
            <div className="p-3 border-b border-gray-200 dark:border-gray-800">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Parties</p>
            </div>
            {draft.parts.map((part, pi) => {
              const saved = part.questions.filter((q) => q.isSaved).length;
              const total = part.questions.length;
              const pct = Math.round((saved / total) * 100);
              return (
                <button
                  key={pi}
                  onClick={() => { setActivePart(pi); setActiveQuestion(0); }}
                  className={`w-full text-left p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors ${
                    activePart === pi ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold ${activePart === pi ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Part {part.number}
                    </span>
                    <span className="text-xs text-gray-400">{saved}/{total}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mb-1.5">{part.title}</p>
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Zone principale ── */}
        <div className="col-span-12 md:col-span-9 space-y-4">

          {/* Infos de la partie */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                currentPart.section === 'LISTENING'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}>
                {currentPart.section === 'LISTENING' ? '🎧 Listening' : '📖 Reading'}
              </span>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Part {currentPart.number} — {currentPart.title}
              </h2>
              <span className="text-xs text-gray-400 ml-auto">
                {savedCount}/{totalCount} sauvegardées
              </span>
            </div>

            {/* Audio de la partie */}
            {currentPart.section === 'LISTENING' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  🎵 Audio de la partie
                </label>
                <div className="flex items-center gap-3">
                  <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                    currentPart.audioUrl
                      ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                  }`}>
                    <input type="file" accept="audio/*" className="hidden" onChange={handlePartAudio} />
                    {uploadingKey === 'part-audio' ? (
                      <span className="text-xs text-blue-600">⏳ Upload...</span>
                    ) : currentPart.audioUrl ? (
                      <span className="text-xs text-green-600">✅ Audio uploadé — cliquez pour changer</span>
                    ) : (
                      <span className="text-xs text-gray-500">📁 Uploader le MP3 de la partie</span>
                    )}
                  </label>
                  {currentPart.audioUrl && (
                    <audio controls src={currentPart.audioUrl} className="h-8 flex-1" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Grille de navigation questions ── */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Questions (Q{cfg.globalStart} → Q{cfg.globalStart + cfg.count - 1})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {currentPart.questions.map((q, qi) => (
                <button
                  key={qi}
                  onClick={() => setActiveQuestion(qi)}
                  className={`w-9 h-9 text-xs font-medium rounded-lg transition-all ${
                    activeQuestion === qi ? 'ring-2 ring-blue-600 ring-offset-1' : ''
                  } ${
                    q.isSaved
                      ? 'bg-green-500 text-white'
                      : !q.isSaved && q.options.some((o) => o.content)
                      ? 'bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {q.globalIndex}
                </button>
              ))}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Sauvegardée</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200 dark:bg-blue-900 inline-block" /> En cours</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 dark:bg-gray-700 inline-block" /> Vide</span>
            </div>
          </div>

          {/* ── Éditeur de la question courante ── */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-5">

            {/* En-tête question */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Question {currentQ.globalIndex}
                </h3>
                {currentQ.isSaved && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    ✅ Sauvegardée
                  </span>
                )}
                {!currentQ.isSaved && currentQ.options.some((o) => o.content) && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    ⚠️ Non sauvegardée
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveQuestion((q) => Math.max(0, q - 1))}
                  disabled={activeQuestion === 0}
                  className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                >
                  ←
                </button>
                <button
                  onClick={() => setActiveQuestion((q) => Math.min(currentPart.questions.length - 1, q + 1))}
                  disabled={activeQuestion === currentPart.questions.length - 1}
                  className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                >
                  →
                </button>
              </div>
            </div>

            {/* Stimulus */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Texte / Passage / Phrase incomplète
              </label>
              <textarea
                rows={4}
                value={currentQ.stimulus}
                onChange={(e) => updateQuestionField('stimulus', e.target.value)}
                placeholder={
                  currentPart.section === 'READING'
                    ? 'Collez le texte du passage ou la phrase incomplète...'
                    : 'Texte optionnel (laissez vide si la question est uniquement audio)...'
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
              />
            </div>

            {/* Image + Audio */}
            <div className="grid grid-cols-2 gap-4">
              {/* Image */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  🖼️ Image (Part 1, Part 7...)
                </label>
                <label className={`flex flex-col items-center justify-center min-h-24 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                  currentQ.imageUrl
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10'
                }`}>
                  <input type="file" accept="image/*" className="hidden" onChange={handleQuestionImage} />
                  {uploadingKey === 'q-image' ? (
                    <span className="text-xs text-blue-600">⏳ Upload en cours...</span>
                  ) : currentQ.imageUrl ? (
                    <div className="text-center">
                      <img src={currentQ.imageUrl} alt="" className="max-h-20 mx-auto rounded mb-1 object-contain" />
                      <p className="text-xs text-green-600">✅ Cliquez pour changer</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <span className="text-3xl">🖼️</span>
                      <p className="text-xs text-gray-400 mt-1">Cliquez pour uploader</p>
                    </div>
                  )}
                </label>
              </div>

              {/* Audio question */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  🎵 Audio spécifique à la question
                </label>
                <label className={`flex flex-col items-center justify-center min-h-24 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                  currentQ.audioUrl
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10'
                }`}>
                  <input type="file" accept="audio/*" className="hidden" onChange={handleQuestionAudio} />
                  {uploadingKey === 'q-audio' ? (
                    <span className="text-xs text-blue-600">⏳ Upload en cours...</span>
                  ) : currentQ.audioUrl ? (
                    <div className="text-center w-full">
                      <audio controls src={currentQ.audioUrl} className="w-full h-8 mb-1" />
                      <p className="text-xs text-green-600">✅ Cliquez pour changer</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <span className="text-3xl">🎵</span>
                      <p className="text-xs text-gray-400 mt-1">Cliquez pour uploader</p>
                    </div>
                  )}
                </label>

                {/* Timestamps Part 3 & 4 */}
                {(currentPart.number === 3 || currentPart.number === 4) && (
                  <div className="flex gap-2 mt-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-400 mb-1">Début (sec)</label>
                      <input
                        type="number"
                        value={currentQ.audioStart}
                        onChange={(e) => updateQuestionField('audioStart', e.target.value)}
                        placeholder="0"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-400 mb-1">Fin (sec)</label>
                      <input
                        type="number"
                        value={currentQ.audioEnd}
                        onChange={(e) => updateQuestionField('audioEnd', e.target.value)}
                        placeholder="30"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Options A B C D */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Réponses — cliquez sur la lettre pour marquer la bonne réponse
              </label>
              <div className="space-y-2">
                {currentQ.options.map((opt, oi) => (
                  <div
                    key={opt.label}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all ${
                      opt.isCorrect
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <button
                      onClick={() => updateOption(oi, 'isCorrect', true)}
                      title="Marquer comme bonne réponse"
                      className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all mt-0.5 ${
                        opt.isCorrect
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:border-green-400 hover:text-green-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={opt.content}
                        onChange={(e) => updateOption(oi, 'content', e.target.value)}
                        placeholder={`Réponse ${opt.label}...`}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {opt.isCorrect && (
                        <input
                          type="text"
                          value={opt.explanation}
                          onChange={(e) => updateOption(oi, 'explanation', e.target.value)}
                          placeholder="Explication pourquoi cette réponse est correcte (optionnel)..."
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-green-400"
                        />
                      )}
                    </div>
                    {opt.isCorrect && <span className="text-green-500 text-lg mt-1">✓</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setActiveQuestion((q) => Math.max(0, q - 1))}
                disabled={activeQuestion === 0}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
              >
                ← Précédente
              </button>

              <button
                onClick={saveCurrentQuestion}
                disabled={isSaving}
                className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
              >
                {isSaving ? '⏳ Sauvegarde...' : '💾 Sauvegarder'}
              </button>

              <button
                onClick={saveAndNext}
                disabled={isSaving || (activePart === draft.parts.length - 1 && activeQuestion === currentPart.questions.length - 1)}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
              >
                Sauvegarder & Suivante →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}