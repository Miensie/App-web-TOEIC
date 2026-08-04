import { Request, Response } from 'express';
import { supabase } from '../../shared/utils/supabase';
import { sendSuccess, sendError } from '../../shared/utils/apiResponse';

export async function syncProfile(req: Request, res: Response): Promise<void> {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) { sendError(res, 'Token manquant', 401); return; }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) { sendError(res, 'Token invalide', 401); return; }

    // Upsert profil
    const { data: profile, error: upsertError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email!,
        firstName: user.user_metadata?.first_name || null,
        lastName: user.user_metadata?.last_name || null,
        updatedAt: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single();

    if (upsertError) { sendError(res, 'Erreur sync', 500); return; }
    sendSuccess(res, profile, 'Profil synchronisé');
  } catch {
    sendError(res, 'Erreur serveur', 500);
  }
}