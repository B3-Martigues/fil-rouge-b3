import type { Organizer } from "../types/organizer";

export const organizersMock: Organizer[] = [
  {
    id: 1,
    user_id: 1,
    organization_id: 101,
    job_role: "Coordinatrice programmation",
    created_at: "2026-06-05T09:00:00.000Z",
    updated_at: "2026-06-05T09:00:00.000Z",
  },
  {
    id: 2,
    user_id: 3,
    organization_id: 102,
    job_role: "Responsable ateliers",
    created_at: "2026-06-06T10:00:00.000Z",
    updated_at: "2026-06-06T10:00:00.000Z",
  },
  {
    id: 3,
    user_id: 3,
    organization_id: 103,
    job_role: "Référent validation",
    created_at: "2026-06-07T10:00:00.000Z",
    updated_at: "2026-06-07T10:00:00.000Z",
  },
];
