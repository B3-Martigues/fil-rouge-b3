import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";
import Input from "../../../shared/components/ui/Input";
import SuccessMessage from "../../../shared/components/feedback/SuccessMessage";
import { ROUTES } from "../../../shared/constants/routes";
import useDataStore from "../../../shared/store/dataStore";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from "../validations/passwordReset.schema";

export default function ForgotPassword() {
  const createPasswordResetNotification = useDataStore(
    (s) => s.createPasswordResetNotification,
  );
  const [loading, setLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched",
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setLoading(true);
    setServerMessage(null);
    setDevResetLink(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const result = createPasswordResetNotification(data.login_email);

      setServerMessage(result.message);
      setDevResetLink(result.resetLink ?? null);
      toast.success("Demande de reinitialisation traitee");
    } catch {
      setServerMessage("Erreur lors de la demande de reinitialisation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <h1>Mot de passe oublie</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField
          label="Email"
          htmlFor="forgot-email"
          error={errors.login_email?.message}
        >
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder="Votre email"
            hasError={!!errors.login_email}
            {...register("login_email")}
          />
        </FormField>

        {serverMessage && <SuccessMessage message={serverMessage} />}

        {devResetLink && (
          <p className="dev-reset-link">
            Lien Ethereal dev: <Link to={new URL(devResetLink).pathname}>ouvrir</Link>
          </p>
        )}

        <Button type="submit" loading={loading}>
          Envoyer le lien
        </Button>
      </form>

      <Link to={ROUTES.PUBLIC.LOGIN}>Retour a la connexion</Link>
    </div>
  );
}
