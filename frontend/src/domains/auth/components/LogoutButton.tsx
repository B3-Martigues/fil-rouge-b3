/**Bouton de déconnexion utilisateur. Réinitialise le store auth puis redirige vers login. */
import { useNavigate } from "react-router-dom";

import useAuthStore from "../store/authStore";
import { authHttpApi } from "../api/authHttp.api";
import { ROUTES } from "../../../shared/constants/routes";

/**UI*/
import Button from "../../../shared/components/ui/Button";
import { toast } from "react-toastify";

export default function LogoutButton() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  /**Déconnexion utilisateur  */
  const handleLogout = async () => {
    await authHttpApi.logout();
    logout();
    toast.success("Déconnexion réussie");
    navigate(ROUTES.PUBLIC.HOME);
  };

  return (
    <Button type="button" onClick={handleLogout}>
      Déconnexion
    </Button>
  );
}
