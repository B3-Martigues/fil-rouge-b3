/**
 * Formulaire de connexion.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { FormModalLink } from "../../../shared/components/forms/FormModalLink";
import { loginSchema, type LoginFormData } from "../validations/login.schema";
import useAuthStore from "../store/authStore";
import { ROUTES } from "../../../shared/constants/routes";
import type { Role } from "../../user/types/user";
import { authenticateMockAccount } from "../api/auth.api";
import useDataStore from "../../../shared/store/dataStore";

import Input from "../../../shared/components/ui/Input";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";

const getRedirectPathByRole = (role: Role) => {
  if (role === "admin") return ROUTES.ADMIN.DASHBOARD;
  if (role === "moderator") return ROUTES.MODERATOR.DASHBOARD;
  if (role === "company") return ROUTES.COMPANY.EVENTS;
  return ROUTES.PUBLIC.HOME;
};

export default function LoginForm() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const accounts = useDataStore((s) => s.accounts);
  const users = useDataStore((s) => s.users);
  const companies = useDataStore((s) => s.companies);

  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setServerError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      const result = authenticateMockAccount(
        { accounts, users, companies },
        data,
      );

      if (!result.ok) {
        setServerError(result.message);
        return;
      }

      login(result.user);

      navigate(getRedirectPathByRole(result.user.role), { replace: true });
      toast.success("Connexion reussie");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Connexion</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField
          label="Email"
          htmlFor="email"
          error={errors.login_email?.message}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="Votre email"
            hasError={!!errors.login_email}
            aria-describedby="email-error"
            {...register("login_email")}
          />
        </FormField>

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

        {serverError && <ErrorMessage message={serverError} />}

        <Button type="submit" loading={loading}>
          Se connecter
        </Button>

        <br />

        <FormModalLink to={ROUTES.PUBLIC.REGISTER}>
          <strong>Pas encore inscrit ?</strong>
        </FormModalLink>
        <br />
        <FormModalLink to={ROUTES.PUBLIC.FORGOT_PASSWORD}>
          <strong>Mot de passe oublie ?</strong>
        </FormModalLink>
      </form>
    </div>
  );
}
