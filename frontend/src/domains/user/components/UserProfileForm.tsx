import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import ConfirmDialog from "../../../shared/components/forms/ConfirmDialog";
import { ROUTES } from "../../../shared/constants/routes";
import { authHttpApi } from "../../auth/api/authHttp.api";
import useAuthStore from "../../auth/store/authStore";
import useDataStore from "../../../shared/store/dataStore";
import {
  profileSchema,
  type ProfileFormData,
} from "../validations/profile.schema";
import { createPasswordChangedNotification } from "../../notification/services/notificationFactory";

import Input from "../../../shared/components/ui/Input";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";

const normalizeComparable = (value: string) => value.trim().toLowerCase();

export default function UserProfileForm() {
  const user = useAuthStore((s) => s.currentUser);
  const updateAuthUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);
  const accounts = useDataStore((s) => s.accounts);
  const users = useDataStore((s) => s.users);
  const updateAccount = useDataStore((s) => s.updateAccount);
  const updateUser = useDataStore((s) => s.updateUser);
  const deleteUser = useDataStore((s) => s.deleteUser);
  const dispatchNotification = useDataStore((s) => s.dispatchNotification);
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const canDeleteOwnAccount = user?.role === "user" && !!user.user_id;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    mode: "onTouched",
    defaultValues: {
      username: user?.username ?? "",
      login_email: user?.login_email ?? "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setLoading(true);
    setServerError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (!user) {
        setServerError("Utilisateur non trouve");
        return;
      }

      const loginEmail = data.login_email.trim();
      const username = data.username.trim();
      const existingAccount = accounts.find(
        (account) =>
          account.id !== user.account_id &&
          normalizeComparable(account.login_email) ===
            normalizeComparable(loginEmail),
      );

      if (existingAccount) {
        setServerError("Cet email est deja utilise");
        return;
      }

      const existingUsername = user.user_id
        ? users.find(
            (item) =>
              item.id !== user.user_id &&
              !item.deleted_at &&
              normalizeComparable(item.username) === normalizeComparable(username),
          )
        : null;

      if (existingUsername) {
        setServerError("Ce nom d'utilisateur est deja utilise");
        return;
      }

      updateAccount(user.account_id, {
        login_email: loginEmail,
      });
      if (user.user_id) {
        updateUser(user.user_id, {
          username,
        });
      }
      updateAuthUser({
        username,
        login_email: loginEmail,
      });

      const newPassword = data.newPassword?.trim() ?? "";

      if (newPassword) {
        const notificationUser = user.user_id
          ? users.find((item) => item.id === user.user_id && !item.deleted_at)
          : null;

        if (user.user_id && !notificationUser) {
          setServerError("Profil utilisateur introuvable");
          return;
        }

        updateAccount(user.account_id, {
          password_hash: newPassword,
          password_changed_at: new Date().toISOString(),
        });
        if (notificationUser) {
          void dispatchNotification(
            createPasswordChangedNotification({
              user: notificationUser,
              profileUrl: ROUTES.USER.PROFILE,
            }),
          );
        }
      }

      reset({
        username,
        login_email: loginEmail,
        newPassword: "",
        confirmPassword: "",
      });
      toast.success(
        newPassword ? "Profil et mot de passe mis à jour" : "Profil mis à jour",
      );
    } catch {
      setServerError("Erreur lors de la mise à jour du profil");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    if (user.user_id) {
      deleteUser(user.user_id);
    }
    await authHttpApi.logout();
    logout();
    toast.success("Compte supprime");
    navigate(ROUTES.PUBLIC.LOGIN);
  };

  return (
    <div className="user-profile">
      <form className="user-profile-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField
          label="Nom d'utilisateur"
          htmlFor="username"
          error={errors.username?.message}
        >
          <Input
            id="username"
            type="text"
            placeholder="Votre nom"
            hasError={!!errors.username}
            {...register("username")}
          />
        </FormField>

        <FormField
          label="Email de connexion"
          htmlFor="login_email"
          error={errors.login_email?.message}
        >
          <Input
            id="login_email"
            type="email"
            placeholder="Votre email"
            autoComplete="email"
            hasError={!!errors.login_email}
            aria-describedby="login_email-error"
            {...register("login_email")}
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
            autoComplete="new-password"
            hasError={!!errors.newPassword}
            aria-describedby="newPassword-error"
            {...register("newPassword")}
          />
        </FormField>

        <FormField
          label="Confirmer nouveau mot de passe"
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            hasError={!!errors.confirmPassword}
            aria-describedby="confirmPassword-error"
            {...register("confirmPassword")}
          />
        </FormField>

        {serverError && <ErrorMessage message={serverError} />}

        <Button type="submit" loading={loading}>
          Enregistrer les modifications
        </Button>
        {canDeleteOwnAccount && (
          <div className="user-profile-actions">
            <Button
              variant="danger"
              type="button"
              onClick={() => setShowDeleteModal(true)}
            >
              Supprimer mon compte
            </Button>
          </div>
        )}
      </form>

      <ConfirmDialog
        confirmLabel="Oui, supprimer"
        message="Cette action est definitive. Toutes vos donnees seront supprimees."
        open={showDeleteModal}
        title="Suppression du compte"
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}
