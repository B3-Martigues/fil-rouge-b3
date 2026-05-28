import type { User } from "../../domains/user/types/user";
/**Verfie si l'utilisateur doit passer par l'onboarding (choix des préférences)*/
export function needsOnboarding(user: User | null): boolean {
  return !user || user.preferences.length === 0;
}
