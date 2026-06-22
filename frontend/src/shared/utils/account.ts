export const accountRoleLabels = {
  admin: "Administrateur",
  moderator: "Modérateur",
  organization: "Organisation",
  user: "Utilisateur",
} as const;

export const getAccountInitials = (name?: string | null) => {
  if (!name) return "U";

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

export const formatMemberSince = (value?: string | null) => {
  if (!value) return "date inconnue";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "date inconnue";

  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(date);
};
