/**Formulaire d'inscription
 * Utilise:
 * - React Hook Form + Zod pour la validation
 * - composants UI (Input, Button, FormField)
 * - composant feedback (ErrorMessage)
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import {
  registerSchema,
  type RegisterFormData,
} from "../validations/register.schema";
import type { AuthenticatedUser, User } from "../../user/types/user";
import { ROUTES } from "../../../shared/constants/routes";
import useAuthStore from "../store/authStore";
import useDataStore from "../../../shared/store/dataStore";

// UI
import Input from "../../../shared/components/ui/Input";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";

// FEEDBACK
export default function RegisterForm() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const users = useDataStore((s) => s.users);
  const addUser = useDataStore((s) => s.addUser);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
  });

  const onSubmit = async (data: RegisterFormData) => {
    setLoading(true);
    setServerError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      /**Vérification email déjà utilsé */
      const existingUser = users.find((user) => user.email === data.email);
      if (existingUser) {
        setServerError("Cet email est déjà utilisé");
        setLoading(false);
        return;
      }

      const newUser: User = {
        id: Date.now(),
        username: data.username,
        email: data.email,
        password: data.password,
        role: "user",
        is_active: true,
        preferences: [],
      };

      addUser(newUser);

      const { password, ...rest } = newUser;
      const safeUser: AuthenticatedUser = rest;
      login(safeUser);

      toast.success("Compte cree avec succes");
      navigate(ROUTES.USER.ONBOARDING_PREFERENCES);
    } catch {
      setServerError("Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Inscription utilisateur</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField
          label="Nom d'utilisateur"
          htmlFor="username"
          error={errors.username?.message}
        >
          <Input
            id="username"
            type="text"
            autoComplete="username"
            placeholder="Votre nom"
            hasError={!!errors.username}
            {...register("username")}
          />
        </FormField>

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
            autoComplete="new-password"
            placeholder="Votre mot de passe"
            hasError={!!errors.password}
            aria-describedby="password-error"
            {...register("password")}
          />
        </FormField>

        <FormField
          label="Confirmer mot de passe"
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Confirmer votre mot de passe"
            hasError={!!errors.confirmPassword}
            aria-describedby="confirmPassword-error"
            {...register("confirmPassword")}
          />
        </FormField>

        {serverError && <ErrorMessage message={serverError} />}

        <Button type="submit" loading={loading}>
          Creer un compte utilisateur
        </Button>
      </form>
    </div>
  );
}
