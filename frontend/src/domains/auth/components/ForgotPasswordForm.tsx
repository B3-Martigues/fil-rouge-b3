import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-toastify";

import { FormModalLink } from "../../../shared/components/forms/FormModalLink";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";
import Input from "../../../shared/components/ui/Input";
import SuccessMessage from "../../../shared/components/feedback/SuccessMessage";
import { ROUTES } from "../../../shared/constants/routes";
import { userApi } from "../../user/api/user.api";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from "../validations/passwordReset.schema";

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);

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

    try {
      const result = await userApi.requestPasswordReset(data.login_email);

      if (!result.ok) {
        setServerMessage(result.error.message);
        return;
      }

      setServerMessage(result.data.message);
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

        <Button type="submit" loading={loading}>
          Envoyer le lien
        </Button>
      </form>

      <FormModalLink to={ROUTES.PUBLIC.LOGIN}>Retour a la connexion</FormModalLink>
    </div>
  );
}
