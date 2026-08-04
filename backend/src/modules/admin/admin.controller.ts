import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../shared/utils/supabase';
import { sendSuccess, sendError } from '../../shared/utils/apiResponse';
import { AuthenticatedRequest } from '../../shared/middleware/authMiddleware';
import Anthropic from '@anthropic-ai/sdk';

// Import pdf-parse avec la syntaxe correcte pour CommonJS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

const optionSchema = z.object({
  label: z.string(),
  content: z.string(),
  isCorrect: z.boolean(),
  explanation: z.string().optional(),
});

const questionSchema = z.object({
  orderIndex: z.number(),
  globalIndex: z.number(),
  type: z.enum(['PHOTO_DESCRIPTION','QUESTION_RESPONSE','CONVERSATION','SHORT_TALK',
    'INCOMPLETE_SENTENCE','TEXT_COMPLETION','READING_COMPREHENSION']),
  stimulus: z.string().optional(),
  imageUrl: z.string().optional(),
  audioUrl: z.string().optional(),
  audioStart: z.number().optional(),
  audioEnd: z.number().optional(),
  options: z.array(optionSchema),
});

const partSchema = z.object({
  number: z.number().int().min(1).max(7),
  section: z.enum(['LISTENING', 'READING']),
  title: z.string(),
  description: z.string().optional(),
  audioUrl: z.string().optional(),
  questions: z.array(questionSchema),
});

const importSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  version: z.string().optional(),
  parts: z.array(partSchema),
});

export async function importTest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, 'JSON invalide', 400, parsed.error.flatten()); return; }

    const { title, description, version, parts } = parsed.data;

    // Créer le test
    const { data: test, error: testError } = await supabase
      .from('tests')
      .insert({ title, description, version: version ?? '1.0' })
      .select()
      .single();

    if (testError) { sendError(res, 'Erreur création test', 500); return; }

    // Créer les parties et questions
    for (let pi = 0; pi < parts.length; pi++) {
      const part = parts[pi];

      const { data: partData, error: partError } = await supabase
        .from('parts')
        .insert({
          testId: test.id,
          number: part.number,
          section: part.section,
          title: part.title,
          description: part.description,
          orderIndex: pi,
          audioUrl: part.audioUrl,
        })
        .select()
        .single();

      if (partError) continue;

      for (const q of part.questions) {
        const { data: questionData, error: questionError } = await supabase
          .from('questions')
          .insert({
            partId: partData.id,
            orderIndex: q.orderIndex,
            globalIndex: q.globalIndex,
            type: q.type,
            stimulus: q.stimulus,
            imageUrl: q.imageUrl,
            audioUrl: q.audioUrl,
            audioStart: q.audioStart,
            audioEnd: q.audioEnd,
          })
          .select()
          .single();

        if (questionError) continue;

        await supabase
          .from('options')
          .insert(q.options.map((o) => ({ ...o, questionId: questionData.id })));
      }
    }

    sendSuccess(res, test, 'Test importé avec succès');
  } catch { sendError(res, "Erreur lors de l'import", 500); }
}

export async function createTest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { title, description, version } = req.body;
    if (!title) { sendError(res, 'Le titre est requis', 400); return; }
    const { data, error } = await supabase.from('tests').insert({ title, description, version }).select().single();
    if (error) { sendError(res, 'Erreur serveur', 500); return; }
    sendSuccess(res, data, 'Test créé');
  } catch { sendError(res, 'Erreur serveur', 500); }
}

export async function updateTestStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    if (!['DRAFT','PUBLISHED','ARCHIVED'].includes(status)) { sendError(res, 'Statut invalide', 400); return; }
    const { data, error } = await supabase.from('tests').update({ status }).eq('id', req.params.id).select().single();
    if (error) { sendError(res, 'Erreur serveur', 500); return; }
    sendSuccess(res, data, 'Statut mis à jour');
  } catch { sendError(res, 'Erreur serveur', 500); }
}

export async function deleteTest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { error } = await supabase.from('tests').delete().eq('id', req.params.id);
    if (error) { sendError(res, 'Erreur serveur', 500); return; }
    sendSuccess(res, null, 'Test supprimé');
  } catch { sendError(res, 'Erreur serveur', 500); }
}

export async function getAllTests(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('tests')
      .select('id, title, version, status, createdAt')
      .order('createdAt', { ascending: false });
    if (error) { sendError(res, 'Erreur serveur', 500); return; }
    sendSuccess(res, data);
  } catch { sendError(res, 'Erreur serveur', 500); }
}

export async function getFullTest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('tests')
      .select(`*, parts(*, questions(*, options(*)))`)
      .eq('id', req.params.id)
      .single();
    if (error || !data) { sendError(res, 'Test introuvable', 404); return; }
    sendSuccess(res, data);
  } catch { sendError(res, 'Erreur serveur', 500); }
}

export async function createPart(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { testId, number, section, title, orderIndex } = req.body;
    const { data, error } = await supabase
      .from('parts')
      .insert({ testId, number, section, title, orderIndex })
      .select().single();
    if (error) { sendError(res, 'Erreur création partie', 500); return; }
    sendSuccess(res, data, 'Partie créée', 201);
  } catch { sendError(res, 'Erreur serveur', 500); }
}

export async function updatePart(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('parts')
      .update(req.body)
      .eq('id', req.params.id)
      .select().single();
    if (error) { sendError(res, 'Erreur mise à jour partie', 500); return; }
    sendSuccess(res, data);
  } catch { sendError(res, 'Erreur serveur', 500); }
}

export async function createQuestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { options, ...questionData } = req.body;
    const { data: question, error } = await supabase
      .from('questions')
      .insert(questionData)
      .select().single();
    if (error) { sendError(res, 'Erreur création question', 500); return; }

    if (options?.length) {
      await supabase.from('options').insert(
        options.map((o: any) => ({ ...o, questionId: question.id }))
      );
    }
    sendSuccess(res, question, 'Question créée', 201);
  } catch { sendError(res, 'Erreur serveur', 500); }
}

export async function updateQuestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { options, ...questionData } = req.body;
    const { data: question, error } = await supabase
      .from('questions')
      .update(questionData)
      .eq('id', req.params.id)
      .select().single();
    if (error) { sendError(res, 'Erreur mise à jour question', 500); return; }

    if (options?.length) {
      // Supprimer les anciennes options et recréer
      await supabase.from('options').delete().eq('questionId', req.params.id);
      await supabase.from('options').insert(
        options.map((o: any) => ({ ...o, questionId: req.params.id }))
      );
    }
    sendSuccess(res, question, 'Question mise à jour');
  } catch { sendError(res, 'Erreur serveur', 500); }
}

export async function importFromPdfs(req: Request, res: Response): Promise<void> {
  try {
    // Multer attache les fichiers sur req.files
    const files = req.files as { [fieldname: string]: { buffer: Buffer; originalname: string }[] };
    const title = (req.body?.title as string) || 'TOEIC Test';

    if (!files?.listening || !files?.reading || !files?.answers) {
      sendError(res, 'Les 3 PDFs sont requis (listening, reading, answers)', 400);
      return;
    }

    // ── Étape 1 : Extraire le texte des PDFs ──
    const [listeningPdf, readingPdf, answersPdf] = await Promise.all([
      pdfParse(files.listening[0].buffer),
      pdfParse(files.reading[0].buffer),
      pdfParse(files.answers[0].buffer),
    ]);

    const listeningText: string = listeningPdf.text;
    const readingText: string = readingPdf.text;
    const answersText: string = answersPdf.text;

    // ── Étape 2 : Appeler Claude pour structurer les données ──
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Extraire les réponses correctes
    const answersResponse = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Tu es un expert TOEIC. Voici le corrigé d'un test TOEIC.

Extrait la liste des réponses correctes pour les questions 1 à 200.
Retourne UNIQUEMENT un objet JSON valide sans markdown, de cette forme exacte :
{"answers": {"1": "B", "2": "C", "3": "A", ...jusqu'à "200": "X"}}

Texte du corrigé :
${answersText.substring(0, 8000)}`,
      }],
    });

    let correctAnswers: Record<string, string> = {};
    try {
      const answersContent = answersResponse.content[0].type === 'text'
        ? answersResponse.content[0].text : '';
      const cleanedAnswers = answersContent.replace(/```json|```/g, '').trim();
      correctAnswers = JSON.parse(cleanedAnswers).answers || {};
    } catch {
      sendError(res, "Erreur lors de l'analyse du corrigé", 500);
      return;
    }

    // Traiter Listening (Parts 1-4, Q1-100)
    const listeningResponse = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: `Tu es un expert TOEIC. Voici le livret Listening (Parts 1-4, questions 1-100).

Extrait toutes les questions avec leurs options A, B, C, D.
Pour la Part 2, seulement A, B, C.
Retourne UNIQUEMENT un JSON valide sans markdown :

{
  "parts": [
    {
      "number": 1,
      "section": "LISTENING",
      "title": "Photographs",
      "description": "For each question, you will hear four statements about a picture.",
      "questions": [
        {
          "globalIndex": 1,
          "orderIndex": 1,
          "type": "PHOTO_DESCRIPTION",
          "stimulus": null,
          "options": [
            {"label": "A", "content": "Statement A", "isCorrect": false},
            {"label": "B", "content": "Statement B", "isCorrect": true},
            {"label": "C", "content": "Statement C", "isCorrect": false},
            {"label": "D", "content": "Statement D", "isCorrect": false}
          ]
        }
      ]
    }
  ]
}

Marque isCorrect: true selon ce dictionnaire : ${JSON.stringify(correctAnswers)}
Pour la Part 1, mets des options génériques ("Statement A", etc.) car les réponses sont audio.
Pour Parts 3 et 4, inclus le texte des conversations dans stimulus.

Texte Listening :
${listeningText.substring(0, 12000)}`,
      }],
    });

    // Traiter Reading (Parts 5-7, Q101-200)
    const readingResponse = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: `Tu es un expert TOEIC. Voici le livret Reading (Parts 5-7, questions 101-200).

Extrait toutes les questions avec leurs options A, B, C, D.
Retourne UNIQUEMENT un JSON valide sans markdown :

{
  "parts": [
    {
      "number": 5,
      "section": "READING",
      "title": "Incomplete Sentences",
      "description": "A word or phrase is missing. Select the best answer.",
      "questions": [
        {
          "globalIndex": 101,
          "orderIndex": 1,
          "type": "INCOMPLETE_SENTENCE",
          "stimulus": "Ms. Durkin asked for volunteers to help ------- with the fitness program.",
          "options": [
            {"label": "A", "content": "she", "isCorrect": false},
            {"label": "B", "content": "her", "isCorrect": false},
            {"label": "C", "content": "hers", "isCorrect": false},
            {"label": "D", "content": "herself", "isCorrect": true}
          ]
        }
      ]
    }
  ]
}

Marque isCorrect: true selon : ${JSON.stringify(correctAnswers)}
Pour la Part 7, inclus le texte complet du passage dans stimulus.

Texte Reading :
${readingText.substring(0, 15000)}`,
      }],
    });

    // ── Étape 3 : Parser les réponses Claude ──
    let listeningParts: any[] = [];
    let readingParts: any[] = [];

    try {
      const lContent = listeningResponse.content[0].type === 'text'
        ? listeningResponse.content[0].text : '';
      listeningParts = JSON.parse(lContent.replace(/```json|```/g, '').trim()).parts || [];
    } catch {
      sendError(res, "Erreur lors de l'analyse du Listening", 500);
      return;
    }

    try {
      const rContent = readingResponse.content[0].type === 'text'
        ? readingResponse.content[0].text : '';
      readingParts = JSON.parse(rContent.replace(/```json|```/g, '').trim()).parts || [];
    } catch {
      sendError(res, "Erreur lors de l'analyse du Reading", 500);
      return;
    }

    const allParts = [...listeningParts, ...readingParts];

    // ── Étape 4 : Insérer en base ──
    const { data: test, error: testError } = await supabase
      .from('tests')
      .insert({ title, version: '1.0' })
      .select()
      .single();

    if (testError || !test) {
      sendError(res, 'Erreur création du test', 500);
      return;
    }

    let totalInserted = 0;

    for (let pi = 0; pi < allParts.length; pi++) {
      const part = allParts[pi];

      const { data: partData, error: partError } = await supabase
        .from('parts')
        .insert({
          testId: test.id,
          number: part.number,
          section: part.section,
          title: part.title,
          description: part.description || null,
          orderIndex: pi,
        })
        .select()
        .single();

      if (partError || !partData) continue;

      for (const q of (part.questions || [])) {
        const { data: questionData, error: qError } = await supabase
          .from('questions')
          .insert({
            partId: partData.id,
            orderIndex: q.orderIndex,
            globalIndex: q.globalIndex,
            type: q.type,
            stimulus: q.stimulus || null,
          })
          .select()
          .single();

        if (qError || !questionData) continue;

        if (q.options?.length) {
          await supabase.from('options').insert(
            q.options.map((o: any) => ({
              questionId: questionData.id,
              label: o.label,
              content: o.content,
              isCorrect: o.isCorrect,
            }))
          );
        }

        totalInserted++;
      }
    }

    sendSuccess(res, {
      testId: test.id,
      title: test.title,
      questionsInserted: totalInserted,
      partsInserted: allParts.length,
    }, `Test importé — ${totalInserted} questions sur ${allParts.length} parties`);

  } catch (err) {
    console.error('Import PDF error:', err);
    sendError(res, "Erreur lors de l'import PDF", 500);
  }
}