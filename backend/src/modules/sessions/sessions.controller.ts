import { Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../shared/utils/supabase';
import { sendSuccess, sendError } from '../../shared/utils/apiResponse';
import { AuthenticatedRequest } from '../../shared/middleware/authMiddleware';
import { calculateToeicScores } from '../../shared/utils/scoreTable';

export async function createSession(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { testId } = req.body;
    if (!testId) { sendError(res, 'testId requis', 400); return; }

    // Session existante ?
    const { data: existing } = await supabase
      .from('exam_sessions')
      .select('*')
      .eq('profileId', req.user!.id)
      .eq('testId', testId)
      .eq('status', 'IN_PROGRESS')
      .single();

    if (existing) { sendSuccess(res, existing, 'Session existante récupérée'); return; }

    // Vérifier le test
    const { data: test } = await supabase
      .from('tests')
      .select('id, totalTime')
      .eq('id', testId)
      .eq('status', 'PUBLISHED')
      .single();

    if (!test) { sendError(res, 'Test introuvable', 404); return; }

    const { data: session, error } = await supabase
      .from('exam_sessions')
      .insert({
        profileId: req.user!.id,
        testId,
        timeRemaining: test.totalTime,
      })
      .select()
      .single();

    if (error) { sendError(res, 'Erreur création session', 500); return; }
    sendSuccess(res, session, 'Session créée');
  } catch { sendError(res, 'Erreur serveur', 500); }
}

export async function getSession(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('exam_sessions')
      .select('*, answers(*)')
      .eq('id', req.params.id)
      .eq('profileId', req.user!.id)
      .single();

    if (error || !data) { sendError(res, 'Session introuvable', 404); return; }
    sendSuccess(res, data);
  } catch { sendError(res, 'Erreur serveur', 500); }
}

const progressSchema = z.object({
  currentQuestion: z.number().int().min(1).max(200),
  timeRemaining: z.number().int().min(0),
  answers: z.array(z.object({
    questionId: z.string(),
    optionId: z.string().nullable(),
    isMarked: z.boolean(),
  })),
});

export async function saveProgress(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = progressSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, 'Données invalides', 400); return; }

    const { currentQuestion, timeRemaining, answers } = parsed.data;
    const sessionId = req.params.id;

    // Mettre à jour la session
    await supabase
      .from('exam_sessions')
      .update({ currentQuestion, timeRemaining, lastActivityAt: new Date().toISOString() })
      .eq('id', sessionId);

    // Upsert les réponses
    if (answers.length > 0) {
      await supabase
        .from('answers')
        .upsert(
          answers.map((a) => ({
            sessionId,
            questionId: a.questionId,
            optionId: a.optionId,
            isMarked: a.isMarked,
            answeredAt: new Date().toISOString(),
          })),
          { onConflict: 'sessionId,questionId' }
        );
    }

    sendSuccess(res, { saved: true });
  } catch { sendError(res, 'Erreur serveur', 500); }
}

export async function submitSession(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const sessionId = req.params.id;

    // Charger la session avec ses réponses
    const { data: session } = await supabase
      .from('exam_sessions')
      .select('*, answers(*)')
      .eq('id', sessionId)
      .eq('profileId', req.user!.id)
      .eq('status', 'IN_PROGRESS')
      .single();

    if (!session) { sendError(res, 'Session introuvable ou déjà soumise', 404); return; }

    // Charger toutes les questions avec la bonne réponse
    const { data: parts } = await supabase
      .from('parts')
      .select('*, questions(*, options(*))')
      .eq('testId', session.testId);

    if (!parts) { sendError(res, 'Erreur chargement test', 500); return; }

    let listeningCorrect = 0;
    let readingCorrect = 0;
    const questionResults = [];

    for (const part of parts) {
      for (const question of part.questions) {
        const correctOption = question.options.find((o: any) => o.isCorrect);
        if (!correctOption) continue;

        const answer = session.answers.find((a: any) => a.questionId === question.id);
        const isCorrect = answer?.optionId === correctOption.id;
        const selectedOption = question.options.find((o: any) => o.id === answer?.optionId);

        if (part.section === 'LISTENING') { if (isCorrect) listeningCorrect++; }
        else { if (isCorrect) readingCorrect++; }

        questionResults.push({
          questionId: question.id,
          selectedLabel: selectedOption?.label ?? null,
          correctLabel: correctOption.label,
          isCorrect,
        });
      }
    }

    const timeTaken = (session.timeRemaining ?? 0) > 0
      ? 7200 - session.timeRemaining
      : 7200;

    const scores = calculateToeicScores(listeningCorrect, readingCorrect);

    // Marquer la session comme soumise
    await supabase
      .from('exam_sessions')
      .update({ status: 'SUBMITTED', submittedAt: new Date().toISOString() })
      .eq('id', sessionId);

    // Créer le résultat
    const { data: result, error: resultError } = await supabase
      .from('results')
      .insert({
        profileId: req.user!.id,
        testId: session.testId,
        sessionId,
        ...scores,
        listeningCorrect,
        readingCorrect,
        totalCorrect: listeningCorrect + readingCorrect,
        timeTaken,
      })
      .select()
      .single();

    if (resultError) { sendError(res, 'Erreur création résultat', 500); return; }

    // Créer les résultats par question
    await supabase
      .from('question_results')
      .insert(questionResults.map((qr) => ({ ...qr, resultId: result.id })));

    sendSuccess(res, result, 'Test soumis avec succès');
  } catch { sendError(res, 'Erreur serveur', 500); }
}