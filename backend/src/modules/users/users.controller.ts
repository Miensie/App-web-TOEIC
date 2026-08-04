import { Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../shared/utils/supabase';
import { sendSuccess, sendError } from '../../shared/utils/apiResponse';
import { AuthenticatedRequest } from '../../shared/middleware/authMiddleware';

export async function getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user!.id)
      .single();
    if (error) { sendError(res, 'Profil introuvable', 404); return; }
    sendSuccess(res, data);
  } catch { sendError(res, 'Erreur serveur', 500); }
}

const updateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().optional(),
});

export async function updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, 'Données invalides', 400); return; }

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...parsed.data, updatedAt: new Date().toISOString() })
      .eq('id', req.user!.id)
      .select()
      .single();

    if (error) { sendError(res, 'Erreur mise à jour', 500); return; }
    sendSuccess(res, data, 'Profil mis à jour');
  } catch { sendError(res, 'Erreur serveur', 500); }
}