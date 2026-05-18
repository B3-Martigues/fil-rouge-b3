/**
 * Formulaire de connexion.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { loginSchema, type LoginFormData } from "../validations/login.schema";
import { usersMock } from "../mocks/users.mock";
import useAuthStore from "../store/authStore";
import { ROUTES } from "../../../shared/constants/routes";
import type { AuthenticatedUser, Role } from "../../user/types/user";

import Input from "../../../shared/components/ui/Input";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";

const getRedirectPathByRole = (role: Role) => {
  if (role === "admin") return ROUTES.ADMIN.DASHBOARD;
  if (role === "company") return ROUTES.COMPANY.DASHBOARD;
  return ROUTES.USER.PROFILE;
};

export default function LoginForm() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

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

      const user = usersMock.find(
        (u) => u.email === data.email && u.password === data.password,
      );

      if (!user) {
        setServerError("Email ou mot de passe incorrect");
        return;
      }

      const { password, ...rest } = user;
      const safeUser: AuthenticatedUser = rest;
      login(safeUser);

      navigate(getRedirectPathByRole(safeUser.role), { replace: true });
      toast.success("Connexion reussie");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Connexion</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
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

        <Link to={ROUTES.PUBLIC.REGISTER}>
          <strong>Pas encore inscrit ?</strong>
        </Link>
      </form>
    </div>
  );
}
