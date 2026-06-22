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
import type { Account, User } from "../../user/types/user";
import {
  getAccountTypeForRole,
  getAccountTypeIdForRole,
  ROLE_IDS,
  type Role,
  toAuthenticatedUser,
} from "../../user/types/user";
import { ROUTES } from "../../../shared/constants/routes";
import useAuthStore from "../store/authStore";
import useDataStore from "../../../shared/store/dataStore";
import { authHttpApi } from "../api/authHttp.api";

// UI
import Input from "../../../shared/components/ui/Input";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";
// FEEDBACK
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";

import { createWelcomeNotification } from "../../notification/services/notificationFactory";

type RegisterFormProps = {
  mode?: "public" | "admin";
  role?: Exclude<Role, "organization">;
  title?: string;
  submitLabel?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
};

const createNextId = (items: { id: number }[]) =>
  Math.max(0, ...items.map((item) => item.id)) + 1;

const normalizeComparable = (value: string) => value.trim().toLowerCase();

export default function RegisterForm({
  mode = "public",
  role = "user",
  title = "Inscription utilisateur",
  submitLabel,
  onCancel,
  onSuccess,
}: RegisterFormProps) {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const accounts = useDataStore((s) => s.accounts);
  const users = useDataStore((s) => s.users);
  const addAccount = useDataStore((s) => s.addAccount);
  const addUser = useDataStore((s) => s.addUser);
  const dispatchNotification = useDataStore((s) => s.dispatchNotification);
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
    const isAdminMode = mode === "admin";

    setLoading(true);
    setServerError(null);

    try {
      const loginEmail = data.login_email.trim();
      const username = data.username.trim();
      if (!isAdminMode) {
        const result = await authHttpApi.registerUser({
          login_email: loginEmail,
          username,
          password: data.password,
        });

        if (!result.ok) {
          setServerError(result.error.message);
          return;
        }

        login(result.data);
        toast.success("Compte cree avec succes");
        navigate(ROUTES.USER.ONBOARDING);
        return;
      }

      /**Vérification email déjà utilsé */
      const existingAccount = accounts.find(
        (account) =>
          normalizeComparable(account.login_email) ===
          normalizeComparable(loginEmail),
      );

      if (existingAccount) {
        setServerError("Cet email est déjà utilisé");
        return;
      }

      const existingUsername = users.find(
        (user) =>
          !user.deleted_at &&
          normalizeComparable(user.username) === normalizeComparable(username),
      );

      if (existingUsername) {
        setServerError("Ce nom d'utilisateur est déjà utilisé");
        return;
      }

      const accountId = createNextId(accounts);
      const userId = createNextId(users);
      const createdAt = new Date().toISOString();
      const account: Account = {
        id: accountId,
        account_type_id: getAccountTypeIdForRole(role),
        account_type: getAccountTypeForRole(role),
        login_email: loginEmail,
        password_hash: data.password,
        is_active: true,
        created_at: createdAt,
        updated_at: createdAt,
      };
      const newUser: User = {
        id: userId,
        account_id: accountId,
        username,
        role_id: ROLE_IDS[role],
        role,
        created_at: createdAt,
        updated_at: createdAt,
      };

      addAccount(account);
      addUser(newUser);
      void dispatchNotification(createWelcomeNotification({ user: newUser }));

      if (isAdminMode) {
        toast.success("Compte cree avec succes");
        onSuccess?.();
        return;
      }

      login(toAuthenticatedUser(account, newUser));

      toast.success("Compte créé avec succès");
      navigate(ROUTES.USER.ONBOARDING);
    } catch {
      setServerError(
        mode === "admin"
          ? "Erreur lors de la creation du compte"
          : "Erreur lors de l'inscription",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={mode === "admin" ? "admin-embedded-form" : undefined}>
      <h1>{title}</h1>

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

        <FormField
          label="Email de connexion"
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

        <div className="admin-actions">
          <Button type="submit" loading={loading}>
            {submitLabel ?? "Creer un compte utilisateur"}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={onCancel}
            >
              Annuler
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
