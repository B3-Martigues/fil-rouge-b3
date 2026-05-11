/**Formulaire de connexion
 * Utilise:
 * - React Hook Form + Zod pour la validation
 * - composants UI (Input, Button, FormField)
 * - composant feedback (ErrorMessage)
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";

import { loginSchema, type LoginFormData } from "../validations/login.schema";
import { usersMock } from "../mocks/users.mock";
import useAuthStore from "../store/authStore";
import { ROUTES } from "../../../shared/constants/routes";
import type { AuthenticatedUser } from "../../user/types/user";

// UI
import Input from "../../../shared/components/ui/Input";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";

// FEEDBACK
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";
import { toast } from "react-toastify";

export default function LoginForm() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  /**Configuration React Hook Form + Zod */
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
  });

  /**Soumission du formulaire */
  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setServerError(null);

    try {
      // Simulation appel API
      await new Promise((resolve) => setTimeout(resolve, 800));

      const user = usersMock.find(
        (u) => u.email === data.email && u.password === data.password,
      );

      if (!user) {
        setServerError("Email ou mot de passe incorrect");
        return;
      }

      /**Suppression du mot de passe avant stockage frontend */
      const { password, ...rest } = user;
      const safeUser: AuthenticatedUser = rest;
      login(safeUser);

      //redirection selon rôle
      if (safeUser.role === "admin") navigate(ROUTES.ADMIN.DASHBOARD);
      else if (safeUser.role === "company") navigate(ROUTES.COMPANY.DASHBOARD);
      else navigate(ROUTES.USER.PROFILE);
      toast.success("Connexion réussie");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div>
      <h1>Connexion</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/*EMAIL*/}
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="Votre email"
            hasError={!!errors.email}
            aria-describedby="email-error"
            {...register("email")}
          />
        </FormField>
        {/*MOT DE PASSE*/}
        <FormField
          label="Mot de passe"
          htmlFor="password"
          error={errors.password?.message}
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Votre mot de passe"
            hasError={!!errors.password}
            aria-describedby="password-error"
            {...register("password")}
          />
        </FormField>
        {/*ERREUR SERVEUR*/}
        {serverError && <ErrorMessage message={serverError} />}
        {/*SUBMIT*/}
        <Button type="submit" loading={loading}>
          Se connecter
        </Button>
        <br />
        {/*Lien d'inscription pour un utilisateur non iscrit*/}
        <Link to={ROUTES.PUBLIC.REGISTER}>
          <strong>Pas encore inscrit ?</strong>
        </Link>
      </form>
    </div>
  );
}
