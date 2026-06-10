import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { Flag } from "lucide-react";
import { toast } from "react-toastify";

import useAuthStore from "../../auth/store/authStore";
import ActionRow from "../../../shared/components/layout/ActionRow";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";
import Select from "../../../shared/components/ui/Select";
import Textarea from "../../../shared/components/ui/Textarea";
import useDataStore from "../../../shared/store/dataStore";
import type { Event } from "../types/event";

const REPORT_REASONS = [
  "Contenu inapproprie",
  "Informations incorrectes",
  "Evenement frauduleux",
  "Autre",
] as const;

type ReportReason = (typeof REPORT_REASONS)[number];

type Props = {
  event: Event;
};

export default function ReportEventButton({ event }: Props) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const moderationReports = useDataStore((s) => s.moderationReports);
  const addModerationReport = useDataStore((s) => s.addModerationReport);
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("Informations incorrectes");
  const [details, setDetails] = useState("");
  const userId = currentUser?.role === "user" ? currentUser.user_id : undefined;
  const existingReport = userId
    ? moderationReports.find(
        (report) =>
          report.target_type === "event" &&
          report.target_id === event.id &&
          report.reporter_user_id === userId &&
          (report.status === "open" || report.status === "reviewing"),
      )
    : null;

  if (!userId) return null;

  const stopCardActivation = (mouseEvent: MouseEvent) => {
    mouseEvent.stopPropagation();
  };

  const stopCardKeyboardActivation = (keyboardEvent: KeyboardEvent) => {
    keyboardEvent.stopPropagation();
  };

  const submitReport = () => {
    const trimmedDetails = details.trim();

    if (trimmedDetails.length < 10) {
      toast.error("Ajoutez au moins 10 caracteres de detail");
      return;
    }

    const report = addModerationReport({
      target_type: "event",
      target_id: event.id,
      reporter_user_id: userId,
      reason,
      details: trimmedDetails,
      priority:
        reason === "Evenement frauduleux" || reason === "Contenu inapproprie"
          ? "high"
          : "medium",
    });

    if (!report) {
      toast.info("Un signalement est deja en cours pour cet evenement");
      return;
    }

    setDetails("");
    setReason("Informations incorrectes");
    setIsOpen(false);
    toast.success("Signalement transmis a la moderation");
  };

  return (
    <div
      className="event-report"
      onClick={stopCardActivation}
      onKeyDown={stopCardKeyboardActivation}
    >
      <Button
        className="event-report__trigger"
        type="button"
        size="sm"
        variant="secondary"
        icon={<Flag size={16} aria-hidden="true" />}
        disabled={!!existingReport}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        {existingReport ? "Signale" : "Signaler"}
      </Button>

      {isOpen && !existingReport && (
        <div className="event-report__form">
          <FormField label="Motif" htmlFor={`report-reason-${event.id}`}>
            <Select
              id={`report-reason-${event.id}`}
              value={reason}
              onChange={(eventChange) =>
                setReason(eventChange.target.value as ReportReason)
              }
            >
              {REPORT_REASONS.map((reportReason) => (
                <option key={reportReason} value={reportReason}>
                  {reportReason}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Details" htmlFor={`report-details-${event.id}`}>
            <Textarea
              id={`report-details-${event.id}`}
              rows={3}
              value={details}
              placeholder="Precisez le probleme"
              onChange={(eventChange) => setDetails(eventChange.target.value)}
            />
          </FormField>
          <ActionRow className="event-report__actions">
            <Button type="button" onClick={submitReport}>
              Envoyer
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsOpen(false)}
            >
              Annuler
            </Button>
          </ActionRow>
        </div>
      )}
    </div>
  );
}
