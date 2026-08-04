import { Request, Response, NextFunction } from 'express';
import { supabase } from '../utils/supabase';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; role: string };
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      res.status(401).json({ success: false, error: 'Token manquant' });
      return;
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ success: false, error: 'Token invalide' });
      return;
    }

    // Récupérer le profil depuis Supabase
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      res.status(401).json({ success: false, error: 'Profil introuvable' });
      return;
    }

    req.user = { id: profile.id, email: profile.email, role: profile.role };
    next();
  } catch {
    res.status(500).json({ success: false, error: "Erreur d'authentification" });
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ success: false, error: 'Accès refusé' });
    return;
  }
  next();
}