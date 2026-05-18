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

import {
  registerSchema,
  type RegisterFormData,
} from "../validations/register.schema";
import type { AuthenticatedUser, User } from "../../user/types/user";
import { ROUTES } from "../../../shared/constants/routes";
import useAuthStore from "../store/authStore";

// UI
import Input from "../../../shared/components/ui/Input";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";

// FEEDBACK
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";
import { toast } from "react-toastify";
import { usersMock } from "../mocks/users.mock";

export default function RegisterForm() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  /**Configuration React Hook Form + Zod */
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
  });

  /**Soumission du formulaire d'inscription*/
  const onSubmit = async (data: RegisterFormData) => {
    setLoading(true); /**Activation du chargement */
    setServerError(null); /**Reset erreurs serveur */

    try {
      // Simulation appel API
      await new Promise((resolve) => setTimeout(resolve, 800));

      /**Vérification email déjà utilsé */
      const existingUser = usersMock.find((user) => user.email === data.email);
      if (existingUser) {
        setServerError("Cet email est déjà utilisé");
        setLoading(false);
        return;
      }

      /**Création utilisateur selon type de compte
       * user - accès direct
       * company - accès limité avant validation admin
       */
      const newUser: User = {
        id: Date.now(),
        username: data.username,
        email: data.email,
        password: data.password,
        role: data.accountType,
        /**Les comptes entreprise doivent être validés avant activation complète */
        is_active: data.accountType === "user",
        preferences: {
          jour: false,
          culture: false,
          musique: false,
          art: false,
          tourisme: false,
          associatif: false,
          famille: false,
          sport: false,
        },
      };

      /**Suppression du mot de passe avant stockage frontend */
      const { password, ...rest } = newUser;
      const safeUser: AuthenticatedUser = rest;
      login(safeUser);
      /**UX feedback selon type de compte */
      if (data.accountType === "company") {
        toast.success("Compte entreprise créé. En attente de validation ");
        navigate(ROUTES.COMPANY.DASHBOARD);
      } else {
        toast.success("Compte créé avec succès");
        navigate(ROUTES.USER.PROFILE);
      }
    } catch {
      setServerError("Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Inscription</h1>
      {/*FORMULAIRE PRINCIPAL
      - handleSubmit: déclenche validation + appel API simulé
      - noValidate: désactive validation HTML native(on utilise Zod à la place) */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/*CHAMP: NOM D'UTILISATEUR*/}
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
        {/*CHAMP: EMAIL*/}
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
        {/*TYPE DE COMPTE*/}
        <FormField
          label="Type de compte"
          htmlFor="accountType"
          error={errors.accountType?.message}
        >
          <div role="radiogroup" aria-label="Type de compte">
            {/**Option utilisateur */}
            <label>
              <input type="radio" value="user" {...register("accountType")} />
              Utilisateur
            </label>
            {/**Option entreprise */}
            <label>
              <input
                type="radio"
                value="company"
                {...register("accountType")}
              />
              Entreprise
            </label>
          </div>
        </FormField>
        {/*CHAMP: MOT DE PASSE*/}
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
        {/*CHAMP: CONFIRMER MOT DE PASSE*/}
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
        {/*ERREUR SERVEUR
          affichée si la requête d'inscription échoue*/}
        {serverError && <ErrorMessage message={serverError} />}
        {/*BOUTON SUBMIT
        - loading block le click
        - affiche état de chargement UX*/}
        <Button type="submit" loading={loading}>
          Créer un compte
        </Button>
      </form>
    </div>
  );
}
