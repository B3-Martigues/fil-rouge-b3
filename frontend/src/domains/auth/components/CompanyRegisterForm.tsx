import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import {
  companyRegisterSchema,
  type CompanyRegisterFormData,
} from "../validations/register.schema";
import type { Account, User } from "../../user/types/user";
import {
  ACCOUNT_TYPE_IDS,
  ROLE_IDS,
  toAuthenticatedCompany,
} from "../../user/types/user";
import type { Company } from "../../companies/types/company";
import type { CompanyMember } from "../../companies/types/company-member";
import { CATEGORIES } from "../../companies/types/company-categories";
import { ROUTES } from "../../../shared/constants/routes";
import useAuthStore from "../store/authStore";
import useDataStore from "../../../shared/store/dataStore";
import Input from "../../../shared/components/ui/Input";
import Button from "../../../shared/components/ui/Button";
import Checkbox from "../../../shared/components/ui/Checkbox";
import CheckboxGroup from "../../../shared/components/ui/CheckboxGroup";
import FormField from "../../../shared/components/ui/FormField";
import Textarea from "../../../shared/components/ui/Textarea";
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";
import { createWelcomeNotification } from "../../notifications/services/notificationFactory";

type CompanyRegisterFormProps = {
  mode?: "public" | "admin";
  title?: string;
  submitLabel?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
};

type CompanyRegisterField = FieldPath<CompanyRegisterFormData>;

const companyRegisterSteps: {
  title: string;
  fields: CompanyRegisterField[];
}[] = [
  {
    title: "Compte",
    fields: [
      "name",
      "member_name",
      "member_job_role",
      "login_email",
      "password",
      "confirmPassword",
    ],
  },
  {
    title: "Entreprise",
    fields: [
      "contact_email",
      "description",
      "website",
      "logo",
      "contact_phone_number",
      "siret",
    ],
  },
  {
    title: "Adresse",
    fields: ["address", "city", "postal_code", "categories"],
  },
];

const createNextId = (items: { id: number }[]) =>
  Math.max(0, ...items.map((item) => item.id)) + 1;

const normalizeComparable = (value: string) => value.trim().toLowerCase();

export default function CompanyRegisterForm({
  mode = "public",
  title = "Inscription entreprise",
  submitLabel,
  onCancel,
  onSuccess,
}: CompanyRegisterFormProps) {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const accounts = useDataStore((s) => s.accounts);
  const users = useDataStore((s) => s.users);
  const companies = useDataStore((s) => s.companies);
  const companyMembers = useDataStore((s) => s.companyMembers);
  const addAccount = useDataStore((s) => s.addAccount);
  const addUser = useDataStore((s) => s.addUser);
  const addCompany = useDataStore((s) => s.addCompany);
  const addCompanyMember = useDataStore((s) => s.addCompanyMember);
  const dispatchNotification = useDataStore((s) => s.dispatchNotification);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<CompanyRegisterFormData>({
    resolver: zodResolver(companyRegisterSchema),
    mode: "onTouched",
    defaultValues: {
      categories: [],
    },
  });

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === companyRegisterSteps.length - 1;
  const step = companyRegisterSteps[currentStep];

  const goToPreviousStep = () => {
    setServerError(null);
    setCurrentStep((value) => Math.max(0, value - 1));
  };

  const goToNextStep = async () => {
    setServerError(null);
    const isValidStep = await trigger(step.fields, { shouldFocus: true });

    if (isValidStep) {
      setCurrentStep((value) =>
        Math.min(companyRegisterSteps.length - 1, value + 1),
      );
    }
  };

  const onSubmit = async (data: CompanyRegisterFormData) => {
    const isAdminMode = mode === "admin";

    setLoading(true);
    setServerError(null);

    try {
      if (!isAdminMode) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      const loginEmail = data.login_email.trim();
      const memberName = data.member_name.trim();
      const memberJobRole = data.member_job_role.trim();
      const companyName = data.name.trim();
      const contactEmail = data.contact_email.trim();
      const siret = data.siret.trim();
      const existingAccount = accounts.find(
        (account) =>
          normalizeComparable(account.login_email) ===
          normalizeComparable(loginEmail),
      );

      if (existingAccount) {
        setServerError("Cet email de connexion est deja utilise");
        setCurrentStep(0);
        return;
      }

      const existingMemberName = users.find(
        (user) =>
          normalizeComparable(user.username) === normalizeComparable(memberName) &&
          !user.deleted_at,
      );

      if (existingMemberName) {
        setServerError("Ce nom de membre est deja utilise");
        setCurrentStep(0);
        return;
      }

      const existingContactEmail = companies.find(
        (company) =>
          normalizeComparable(company.contact_email) ===
          normalizeComparable(contactEmail),
      );

      if (existingContactEmail) {
        setServerError("Cet email de contact est deja utilise");
        setCurrentStep(1);
        return;
      }

      const existingSiret = companies.find(
        (company) =>
          normalizeComparable(company.siret ?? "") === normalizeComparable(siret),
      );

      if (existingSiret) {
        setServerError("Ce SIRET est deja utilise");
        setCurrentStep(1);
        return;
      }

      const accountId = createNextId(accounts);
      const userId = createNextId(users);
      const companyId = createNextId(companies);
      const companyMemberId = createNextId(companyMembers);
      const createdAt = new Date().toISOString();
      const account: Account = {
        id: accountId,
        account_type_id: ACCOUNT_TYPE_IDS.company,
        account_type: "company",
        login_email: loginEmail,
        password_hash: data.password,
        is_active: true,
        created_at: createdAt,
        updated_at: createdAt,
      };
      const memberUser: User = {
        id: userId,
        account_id: accountId,
        username: memberName,
        role_id: ROLE_IDS.company,
        role: "company",
        created_at: createdAt,
        updated_at: createdAt,
      };
      const company: Company = {
        id: companyId,
        account_id: accountId,
        name: companyName,
        contact_email: contactEmail,
        role_id: ROLE_IDS.company,
        description: data.description.trim(),
        website: data.website.trim(),
        address: data.address.trim(),
        city: data.city.trim(),
        postal_code: data.postal_code.trim(),
        logo: data.logo.trim(),
        contact_phone_number: data.contact_phone_number.trim(),
        siret,
        is_verified: isAdminMode,
        is_active: isAdminMode,
        created_at: createdAt,
        updated_at: createdAt,
        category_slugs: data.categories,
      };
      const companyMember: CompanyMember = {
        id: companyMemberId,
        user_id: userId,
        company_id: companyId,
        job_role: memberJobRole,
        created_at: createdAt,
        updated_at: createdAt,
      };

      addAccount(account);
      addUser(memberUser);
      addCompany(company);
      addCompanyMember(companyMember);
      void dispatchNotification(
        createWelcomeNotification({ user: memberUser, company }),
      );

      if (isAdminMode) {
        toast.success("Compte entreprise cree");
        onSuccess?.();
        return;
      }

      login(toAuthenticatedCompany({ account, user: memberUser, company }));
      toast.success("Compte entreprise cree. En attente de validation");
      navigate(ROUTES.COMPANY.DASHBOARD);
    } catch {
      setServerError(
        mode === "admin"
          ? "Erreur lors de la creation de l'entreprise"
          : "Erreur lors de l'inscription entreprise",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>{title}</h1>

      <ol className="form-stepper" aria-label="Progression du formulaire">
        {companyRegisterSteps.map((item, index) => (
          <li
            className={index === currentStep ? "is-active" : ""}
            key={item.title}
          >
            <span>{index + 1}</span>
            {item.title}
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {currentStep === 0 && (
          <fieldset className="auth-form-section">
            <legend>Compte et membre principal</legend>

            <FormField
              label="Nom de l'entreprise"
              htmlFor="name"
              error={errors.name?.message}
            >
              <Input
                id="name"
                type="text"
                autoComplete="organization"
                placeholder="Nom de l'entreprise"
                hasError={!!errors.name}
                {...register("name")}
              />
            </FormField>

            <FormField
              label="Nom du membre"
              htmlFor="member_name"
              error={errors.member_name?.message}
            >
              <Input
                id="member_name"
                type="text"
                autoComplete="name"
                placeholder="Nom du responsable"
                hasError={!!errors.member_name}
                {...register("member_name")}
              />
            </FormField>

            <FormField
              label="Fonction"
              htmlFor="member_job_role"
              error={errors.member_job_role?.message}
            >
              <Input
                id="member_job_role"
                type="text"
                autoComplete="organization-title"
                placeholder="Responsable evenementiel"
                hasError={!!errors.member_job_role}
                {...register("member_job_role")}
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
                placeholder="contact@entreprise.fr"
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
          </fieldset>
        )}

        {currentStep === 1 && (
          <fieldset className="auth-form-section">
            <legend>Informations entreprise</legend>

            <FormField
              label="Email de contact"
              htmlFor="contact_email"
              error={errors.contact_email?.message}
            >
              <Input
                id="contact_email"
                type="email"
                autoComplete="email"
                placeholder="contact@entreprise.fr"
                hasError={!!errors.contact_email}
                aria-describedby="contact_email-error"
                {...register("contact_email")}
              />
            </FormField>

            <FormField
              label="Description"
              htmlFor="description"
              error={errors.description?.message}
            >
              <Textarea
                id="description"
                hasError={!!errors.description}
                placeholder="Description de l'entreprise"
                rows={4}
                {...register("description")}
              />
            </FormField>

            <FormField
              label="Site web"
              htmlFor="website"
              error={errors.website?.message}
            >
              <Input
                id="website"
                type="url"
                autoComplete="url"
                placeholder="https://example.fr"
                hasError={!!errors.website}
                {...register("website")}
              />
            </FormField>

            <FormField label="Logo" htmlFor="logo" error={errors.logo?.message}>
              <Input
                id="logo"
                type="url"
                placeholder="https://example.fr/logo.png"
                hasError={!!errors.logo}
                {...register("logo")}
              />
            </FormField>

            <FormField
              label="Telephone"
              htmlFor="contact_phone_number"
              error={errors.contact_phone_number?.message}
            >
              <Input
                id="contact_phone_number"
                type="tel"
                autoComplete="tel"
                placeholder="0601020304"
                hasError={!!errors.contact_phone_number}
                {...register("contact_phone_number")}
              />
            </FormField>

            <FormField label="SIRET" htmlFor="siret" error={errors.siret?.message}>
              <Input
                id="siret"
                type="text"
                inputMode="numeric"
                placeholder="12345678901234"
                hasError={!!errors.siret}
                {...register("siret")}
              />
            </FormField>
          </fieldset>
        )}

        {currentStep === 2 && (
          <fieldset className="auth-form-section">
            <legend>Adresse et categories</legend>

            <FormField
              label="Adresse"
              htmlFor="address"
              error={errors.address?.message}
            >
              <Input
                id="address"
                type="text"
                autoComplete="street-address"
                placeholder="Adresse de l'entreprise"
                hasError={!!errors.address}
                {...register("address")}
              />
            </FormField>

            <FormField label="Ville" htmlFor="city" error={errors.city?.message}>
              <Input
                id="city"
                type="text"
                autoComplete="address-level2"
                placeholder="Marseille"
                hasError={!!errors.city}
                {...register("city")}
              />
            </FormField>

            <FormField
              label="Code postal"
              htmlFor="postal_code"
              error={errors.postal_code?.message}
            >
              <Input
                id="postal_code"
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="13001"
                hasError={!!errors.postal_code}
                {...register("postal_code")}
              />
            </FormField>

            <CheckboxGroup
              error={errors.categories?.message}
              label="Categories"
              labelId="categories"
            >
                {CATEGORIES.map((category) => (
                  <Checkbox
                    key={category}
                    label={category}
                    value={category}
                    {...register("categories")}
                  />
                ))}
            </CheckboxGroup>
          </fieldset>
        )}

        {serverError && <ErrorMessage message={serverError} />}

        <div className="form-step-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={loading || isFirstStep}
            onClick={goToPreviousStep}
          >
            Precedent
          </Button>

          {isLastStep ? (
            <Button type="submit" loading={loading}>
              {submitLabel ?? "Creer un compte entreprise"}
            </Button>
          ) : (
            <Button type="button" disabled={loading} onClick={goToNextStep}>
              Suivant
            </Button>
          )}

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
