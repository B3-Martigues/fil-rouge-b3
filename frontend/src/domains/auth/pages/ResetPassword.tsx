import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import Button from "../../../shared/components/ui/Button";
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";
import FormField from "../../../shared/components/ui/FormField";
import Input from "../../../shared/components/ui/Input";
import { ROUTES } from "../../../shared/constants/routes";
import useDataStore from "../../../shared/store/dataStore";
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from "../validations/passwordReset.schema";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const resetPasswordWithToken = useDataStore((s) => s.resetPasswordWithToken);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setLoading(true);
    setServerError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const result = resetPasswordWithToken(token ?? "", data.newPassword);

      if (!result.ok) {
        setServerError(result.message);
        return;
      }

      toast.success(result.message);
      navigate(ROUTES.PUBLIC.LOGIN, { replace: true });
    } catch {
      setServerError("Erreur lors de la reinitialisation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <h1>Reinitialiser le mot de passe</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
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
            autoComplete="new-password"
            hasError={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
        </FormField>

        {serverError && <ErrorMessage message={serverError} />}

        <Button type="submit" loading={loading}>
          Mettre a jour
        </Button>
      </form>

      <Link to={ROUTES.PUBLIC.LOGIN}>Retour a la connexion</Link>
    </div>
  );
}
