/**Ce fichier definit le type AuthState
 * Il représente l'état global de l'authentification dans l'application
 */
import type { AuthenticatedUser, Role } from "../../user/types/user";

/**AuthState décrit :
 * - si l'utilisateur est connecté
 * - les informations de l'utilisateur courant
 * - son rôle (user, admin, company)
 * - les fonctions pour se connecter et se déconnecter
 */
export type AuthState = {
  isAuthenticated: boolean;
  currentUser: AuthenticatedUser | null;
  role: Role | null;

  login: (user: AuthenticatedUser) => void;
  logout: () => void;


  /**Met à jour les données utilisateur */
  updateUser: (updatedUser: Partial<AuthenticatedUser>) => void;
};
