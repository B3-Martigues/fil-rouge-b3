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
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";

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
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [showDeleteModal, setShowDeleteModal] = useState(false);


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

  /**Suppression de compte */
  const handleDeleteAccount = () => {
    if (!user) return;

    const userIndex = usersMock.findIndex((u) => u.id === user.id);

    if (userIndex !== -1) {
      usersMock.splice(userIndex, 1);
    }

    logout();
    toast.success("Compte supprimé");

    navigate("/login");
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
        <Button
          type="button"
          onClick={() => navigate("/profile/change-password")}
        >
           Modifier le mot  passe
        </Button>

        <Button type="button" onClick={() => setShowDeleteModal(true)}>
          Supprimer mon compte
        </Button>
      </form>

      {showDeleteModal && createPortal(
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '24px', 
            borderRadius: '8px', 
            maxWidth: '448px', 
            width: '100%', 
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            color: '#1a1a1a'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '8px' }}>
              ⚠️ Suppression du compte
            </h2>
            <p style={{ marginBottom: '16px', color: '#4a5568' }}>
              Cette action est <strong>définitive</strong>.  
              Toutes vos données seront supprimées.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button type="button" onClick={() => setShowDeleteModal(false)}>
                Annuler
              </Button>
              <Button type="button" onClick={handleDeleteAccount}>
                Oui, supprimer
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}