import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import {
  companyRegisterSchema,
  type CompanyRegisterFormData,
} from "../validations/register.schema";
import type { AuthenticatedUser, User } from "../../user/types/user";
import type { Company } from "../../companies/types/company";
import { CATEGORIES } from "../../companies/types/company-categories";
import { ROUTES } from "../../../shared/constants/routes";
import useAuthStore from "../store/authStore";
import useDataStore from "../../../shared/store/dataStore";

import Input from "../../../shared/components/ui/Input";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function CompanyRegisterForm() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const users = useDataStore((s) => s.users);
  const addUser = useDataStore((s) => s.addUser);
  const addCompany = useDataStore((s) => s.addCompany);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyRegisterFormData>({
    resolver: zodResolver(companyRegisterSchema),
    mode: "onTouched",
    defaultValues: {
      categories: [],
    },
  });

  const onSubmit = async (data: CompanyRegisterFormData) => {
    setLoading(true);
    setServerError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      const existingUser = users.find((user) => user.email === data.email);
      if (existingUser) {
        setServerError("Cet email est deja utilise");
        setLoading(false);
        return;
      }

      const now = new Date().toISOString();
      const company: Company = {
        id: Date.now(),
        name: data.name,
        email: data.email,
        password_hash: data.password,
        description: data.description,
        website: data.website,
        address: data.address,
        logo: data.logo,
        phone_number: Number(data.phone_number),
        siret: data.siret,
        is_verified: false,
        is_active: false,
        created_at: now,
        updated_at: now,
        categories: data.categories.map((category, index) => ({
          id: index + 1,
          name: category,
          slug: toSlug(category),
        })),
      };

      const companyUser: User = {
        id: company.id,
        username: company.name,
        email: company.email,
        password: data.password,
        role: "company",
        is_active: company.is_active,
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

      addUser(companyUser);
      addCompany(company);

      const { password, ...rest } = companyUser;
      const safeUser: AuthenticatedUser = rest;
      login(safeUser);

      toast.success("Compte entreprise cree. En attente de validation");
      navigate(ROUTES.COMPANY.DASHBOARD);
    } catch {
      setServerError("Erreur lors de l'inscription entreprise");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Inscription entreprise</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
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

        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="contact@entreprise.fr"
            hasError={!!errors.email}
            aria-describedby="email-error"
            {...register("email")}
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

        <FormField
          label="Description"
          htmlFor="description"
          error={errors.description?.message}
        >
          <textarea
            id="description"
            className={`input ${errors.description ? "input-error" : ""}`}
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

        <FormField
          label="Telephone"
          htmlFor="phone_number"
          error={errors.phone_number?.message}
        >
          <Input
            id="phone_number"
            type="tel"
            autoComplete="tel"
            placeholder="0601020304"
            hasError={!!errors.phone_number}
            {...register("phone_number")}
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

        <FormField
          label="Categories"
          htmlFor="categories"
          error={errors.categories?.message}
        >
          <div
            id="categories"
            role="group"
            aria-invalid={!!errors.categories}
            className={`categories-select ${
              errors.categories ? "input-error" : ""
            }`}
          >
            {CATEGORIES.map((category) => (
              <label key={category} className="categories-select__option">
                <input
                  type="checkbox"
                  value={category}
                  {...register("categories")}
                />
                {category}
              </label>
            ))}
          </div>
        </FormField>

        {serverError && <ErrorMessage message={serverError} />}

        <Button type="submit" loading={loading}>
          Creer un compte entreprise
        </Button>
      </form>
    </div>
  );
}
