import type {
  ModerationDecision,
  ModerationReport,
} from "../types/moderation";

export const moderationReportsMock: ModerationReport[] = [
  {
    id: 1,
    target_type: "event",
    target_id: 1002,
    reporter_user_id: 1,
    reason: "Contenu commercial trop insistant",
    details:
      "La description ressemble davantage a une publicite qu'a un evenement local.",
    status: "open",
    priority: "medium",
    created_at: "2026-06-02T09:15:00.000Z",
    updated_at: "2026-06-02T09:15:00.000Z",
    resolved_at: null,
    handled_by_user_id: null,
    resolution_note: null,
  },
  {
    id: 2,
    target_type: "event",
    target_id: 1007,
    reporter_user_id: 3,
    reason: "Informations possiblement trompeuses",
    details:
      "Le lieu annonce semble different de celui indique dans les informations pratiques.",
    status: "reviewing",
    priority: "high",
    created_at: "2026-06-03T13:40:00.000Z",
    updated_at: "2026-06-03T15:05:00.000Z",
    resolved_at: null,
    handled_by_user_id: 5,
    resolution_note: null,
  },
  {
    id: 3,
    target_type: "organization",
    target_id: 103,
    reporter_user_id: 1,
    reason: "Justificatifs organization incomplets",
    details:
      "Le compte organization ne presente pas assez d'elements pour valider son activite.",
    status: "open",
    priority: "low",
    created_at: "2026-06-03T16:20:00.000Z",
    updated_at: "2026-06-03T16:20:00.000Z",
    resolved_at: null,
    handled_by_user_id: null,
    resolution_note: null,
  },
  {
    id: 4,
    target_type: "account",
    target_id: 8,
    reporter_user_id: 3,
    reason: "Comportement contraire aux regles",
    details:
      "Plusieurs interventions de ce compte ont ete signalees comme problematiques.",
    status: "resolved",
    priority: "high",
    created_at: "2026-06-04T10:15:00.000Z",
    updated_at: "2026-06-04T11:30:00.000Z",
    resolved_at: "2026-06-04T11:30:00.000Z",
    handled_by_user_id: 7,
    resolution_note:
      "Decision: signalement confirme, le compte reste suspendu apres verification.",
  },
];

export const moderationDecisionsMock: ModerationDecision[] = [
  {
    id: 1,
    action: "event_hidden",
    target_type: "event",
    target_id: 1008,
    moderator_user_id: 5,
    reason: "Evenement annule par l'organisateur, masque du public.",
    created_at: "2026-06-01T09:00:00.000Z",
  },
  {
    id: 2,
    action: "report_resolved",
    target_type: "account",
    target_id: 8,
    moderator_user_id: 7,
    reason:
      "Decision: signalement confirme, le compte reste suspendu apres verification.",
    created_at: "2026-06-04T11:30:00.000Z",
  },
];
