import { Link } from "react-router-dom";

import { ROUTES } from "../../../shared/constants/routes";

export default function Register() {
  return (
    <div className="auth-page">
      <h1>Inscription</h1>

      <div className="register-choice">
        <Link className="btn" to={ROUTES.PUBLIC.REGISTER_USER}>
          Inscription utilisateur
        </Link>

        <Link className="btn" to={ROUTES.PUBLIC.REGISTER_COMPANY}>
          Inscription entreprise
        </Link>
      </div>
    </div>
  );
}
