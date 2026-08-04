import { Response } from 'express';
import { supabase } from '../../shared/utils/supabase';
import { sendSuccess, sendError } from '../../shared/utils/apiResponse';
import { AuthenticatedRequest } from '../../shared/middleware/authMiddleware';

export async function getUserResults(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('results')
      .select('*, tests(title, version)')
      .eq('profileId', req.user!.id)
      .order('completedAt', { ascending: false });

    if (error) { sendError(res, 'Erreur serveur', 500); return; }
    sendSuccess(res, data);
  } catch { sendError(res, 'Erreur serveur', 500); }
}

export async function getResultById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('results')
      .select(`
        *,
        tests (title),
        question_results (
          *,
          questions (
            *,
            options (*),
            parts (number, section, title)
          ),
          personal_notes (*)
        )
      `)
      .eq('id', req.params.id)
      .eq('profileId', req.user!.id)
      .single();

    if (error || !data) { sendError(res, 'Résultat introuvable', 404); return; }
    sendSuccess(res, data);
  } catch { sendError(res, 'Erreur serveur', 500); }
}