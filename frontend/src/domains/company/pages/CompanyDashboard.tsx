/**
 * Tableau de bord entreprise.
 * Affiche un message spécifique si le compte est en attente de validation administrateur
 */

import { useCompanyAccess } from "../hooks/useCompanyAccess";

export default function CompanyDashboard() {
  /**Récuperation des permissions entreprise */
  const { isPendingApproval } = useCompanyAccess();

  /**Compte entreprise non encore validé */
  if (isPendingApproval) {
    return (
      <div>
        <h2>Votre compte est en attente de validation</h2>
        <p>Votre compte doit être validé par un administrateur avant de pouvoir créer des événements</p>
      </div>
    );
  }
  /**Compte entreprise validé */
  return (
    <div>
      <h1>Gestion des événements </h1>
      <p>Bienvenue sur votre espace entreprise</p>
    </div>
  );
}
