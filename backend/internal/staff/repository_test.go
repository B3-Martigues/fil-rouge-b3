package staff

import "testing"

func TestCanApplyAction_ModeratorReviewActions(t *testing.T) {
	for _, action := range []string{
		"event_approved",
		"event_rejected",
		"organization_approved",
		"organization_rejected",
	} {
		t.Run(action, func(t *testing.T) {
			if !canApplyAction("moderator", action) {
				t.Fatalf("expected moderator to apply %s", action)
			}
		})
	}
}

func TestOrganizationDecisionLabelsKeepApproveAndRejectDistinct(t *testing.T) {
	if got := notificationTitle("organization_approved"); got != "Organisation validee" {
		t.Fatalf("expected approval title, got %q", got)
	}
	if got := notificationTitle("organization_rejected"); got != "Organisation refusee" {
		t.Fatalf("expected rejection title, got %q", got)
	}
}
