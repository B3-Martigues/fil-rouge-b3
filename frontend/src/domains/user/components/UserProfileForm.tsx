/**
 * Formulaire de modification du profil utilisateur.
 * Utilise:
 * - React Hook Form + Zod
 * - composants UI réutilisables
 * - Zustand pour mettre à jour le store
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import useAuthStore from "../../auth/store/authStore";

import {
  profileSchema,
  type ProfileFormData,
} from "../validations/profile.schema";

import { usersMock } from "../../auth/mocks/users.mock";

// UI
import Input from "../../../shared/components/ui/Input";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";

// FEEDBACK
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";

import { toast } from "react-toastify";

export default function UserProfileForm() {
  const user = useAuthStore((s) => s.currentUser);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  /**Configuration React Hook Form + Zod */
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),

    mode: "onTouched",

    /**Valeurs par défaut du formulaire */
    defaultValues: {
      username: user?.username ?? "",
      email: user?.email ?? "",
    },
  });

  /**Soumission du formulaire */
  const onSubmit = async (data: ProfileFormData) => {
    setLoading(true);
    setServerError(null);

    try {
      /**Simulation appel API */
      await new Promise((resolve) => setTimeout(resolve, 800));

      /**Mise à jour du mock utilisateur */
      const existingUser = usersMock.find((u) => u.id === user?.id);

      if (existingUser) {
        existingUser.username = data.username;
        existingUser.email = data.email;
      }

      /**Mise à jour du store Zustand */
      updateUser({
        username: data.username,
        email: data.email,
      });

      toast.success("Profil mis à jour");
    } catch {
      setServerError("Erreur lors de la mise à jour du profil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Mon profil</h1>

      {/*FORMULAIRE PRINCIPAL */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/*CHAMP: NOM UTILISATEUR */}
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

        {/*CHAMP: EMAIL */}
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            placeholder="Votre email"
            autoComplete="email"
            hasError={!!errors.email}
            aria-describedby="email-error"
            {...register("email")}
          />
        </FormField>

        {/*ERREUR SERVEUR */}
        {serverError && <ErrorMessage message={serverError} />}

        {/*BOUTON SUBMIT */}
        <Button type="submit" loading={loading}>
          Enregistrer les modifications
        </Button>
      </form>
    </div>
  );
}