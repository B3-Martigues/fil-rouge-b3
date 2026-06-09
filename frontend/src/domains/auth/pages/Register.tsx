import { FormModalLink } from "../../../shared/components/forms/FormModalLink";
import { ROUTES } from "../../../shared/constants/routes";

export default function Register() {
  return (
    <div className="auth-page">
      <h1>Inscription</h1>

      <div className="register-choice">
        <FormModalLink className="btn" to={ROUTES.PUBLIC.REGISTER_USER}>
          Inscription utilisateur
        </FormModalLink>

        <FormModalLink className="btn" to={ROUTES.PUBLIC.REGISTER_COMPANY}>
          Inscription entreprise
        </FormModalLink>
      </div>
    </div>
  );
}
