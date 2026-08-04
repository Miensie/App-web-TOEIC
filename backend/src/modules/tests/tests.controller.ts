import { Response } from 'express';
import { supabase } from '../../shared/utils/supabase';
import { sendSuccess, sendError } from '../../shared/utils/apiResponse';
import { AuthenticatedRequest } from '../../shared/middleware/authMiddleware';

export async function getPublishedTests(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('tests')
      .select('id, title, description, version, totalTime, createdAt')
      .eq('status', 'PUBLISHED')
      .order('createdAt', { ascending: false });

    if (error) { sendError(res, 'Erreur serveur', 500); return; }
    sendSuccess(res, data);
  } catch { sendError(res, 'Erreur serveur', 500); }
}

export async function getTestById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('tests')
      .select(`
        *,
        parts (
          *,
          questions (
            *,
            options (*)
          )
        )
      `)
      .eq('id', req.params.id)
      .eq('status', 'PUBLISHED')
      .single();

    if (error || !data) { sendError(res, 'Test introuvable', 404); return; }
    sendSuccess(res, data);
  } catch { sendError(res, 'Erreur serveur', 500); }
}