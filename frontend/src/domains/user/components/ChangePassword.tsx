import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { ROUTES } from "../../../shared/constants/routes";
import { authHttpApi } from "../../auth/api/authHttp.api";
import useAuthStore from "../../auth/store/authStore";
import useDataStore from "../../../shared/store/dataStore";
import {
  changePasswordSchema,
  type ChangePasswordFormData,
} from "../validations/changePassword.schema";
import { createPasswordChangedNotification } from "../../notification/services/notificationFactory";

import Input from "../../../shared/components/ui/Input";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";

export default function ChangePassword() {
  const user = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const updateAccount = useDataStore((s) => s.updateAccount);
  const accounts = useDataStore((s) => s.accounts);
  const users = useDataStore((s) => s.users);
  const dispatchNotification = useDataStore((s) => s.dispatchNotification);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onTouched",
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setLoading(true);
    setServerError(null);

    try {
      if (!user) {
        setServerError("Utilisateur non trouve");
        return;
      }

      if (user.auth_source === "api") {
        const result = await authHttpApi.changePassword({
          current_password: data.oldPassword,
          new_password: data.newPassword,
        });

        if (!result.ok) {
          setServerError(result.error.message);
          return;
        }

        logout();
        toast.success("Mot de passe mis a jour. Reconnectez-vous.");
        navigate(ROUTES.PUBLIC.LOGIN);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 800));

      const account = accounts.find((item) => item.id === user.account_id);
      const notificationUser = users.find(
        (item) => item.id === user.user_id && !item.deleted_at,
      );

      if (!account) {
        setServerError("Compte introuvable");
        return;
      }

      if (!notificationUser) {
        setServerError("Profil utilisateur introuvable");
        return;
      }

      if (account.password_hash !== data.oldPassword) {
        setServerError("Ancien mot de passe incorrect");
        return;
      }

      updateAccount(user.account_id, {
        password_hash: data.newPassword,
        password_changed_at: new Date().toISOString(),
      });
      void dispatchNotification(
        createPasswordChangedNotification({
          user: notificationUser,
          profileUrl: ROUTES.USER.PROFILE,
        }),
      );

      toast.success("Mot de passe mis a jour");
      navigate(ROUTES.USER.PROFILE);
    } catch {
      setServerError("Erreur lors du changement de mot de passe");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Changer le mot de passe</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField
          label="Ancien mot de passe"
          htmlFor="oldPassword"
          error={errors.oldPassword?.message}
        >
          <Input
            id="oldPassword"
            type="password"
            hasError={!!errors.oldPassword}
            aria-describedby="oldPassword-error"
            {...register("oldPassword")}
          />
        </FormField>

        <FormField
          label="Nouveau mot de passe"
          htmlFor="newPassword"
          error={errors.newPassword?.message}
        >
          <Input
            id="newPassword"
            type="password"
            hasError={!!errors.newPassword}
            aria-describedby="newPassword-error"
            {...register("newPassword")}
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
            hasError={!!errors.confirmPassword}
            aria-describedby="confirmPassword-error"
            {...register("confirmPassword")}
          />
        </FormField>

        {serverError && <ErrorMessage message={serverError} />}

        <Button type="submit" loading={loading}>
          Modifier le mot de passe
        </Button>
      </form>
    </div>
  );
}
