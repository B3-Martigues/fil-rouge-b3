/**Page de connexion
 * Affiche le formulaire de connexion avec une mise en page adaptee.*/
import { Link } from "react-router-dom";

import { ROUTES } from "../../../shared/constants/routes";
import LoginForm from "../components/LoginForm";

export default function Login() {
  return (
    <div className="auth-page auth-page--login">
      <div className="auth-mobile-hero">
        <p className="auth-mobile-hero__brand">Mappening</p>
        <p>Trouvez les meilleurs evenements autour de vous !</p>
      </div>

      <div className="auth-login-stack">
        <section className="auth-login" aria-labelledby="login-title">
          <div className="auth-login__intro">
            <p className="auth-login__brand">Mappening</p>
            <h1 id="login-title">Connexion</h1>
            <p>Retrouvez vos evenements, favoris et preferences.</p>
          </div>

          <LoginForm />
        </section>

        <p className="auth-login-divider">ou</p>

        <Link
          className="btn btn--secondary auth-guest-link"
          to={ROUTES.PUBLIC.HOME}
        >
          Continuer en tant qu&apos;invit&eacute;
        </Link>
      </div>
    </div>
  );
}
