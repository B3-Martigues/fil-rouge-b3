import useAuthStore from "../../auth/store/authStore";

/**Hook centralisant la logique d'accès pour les comptes entreprise */

export function useCompanyAccess() {
  /**Récuperation utilisateur connecté depuis Zustand */
  const user = useAuthStore((s) => s.currentUser);

  /**Vérifie si le compte connecté est une entreprise */
  const isCompany = user?.role === "company";

  /**Status d'activation du compte entreprise */
  const isActive = user?.is_active ?? false;

  /**Compte entreprise en attente de validation administrateur */
  const isPendingApproval = isCompany && !isActive;

  /**Autorisation de gestion des événements */
  const canManageEvents = isCompany && isActive;

  return {
    isCompany,
    isActive,
    isPendingApproval,
    canManageEvents,
  };
}
