- [ ] Run a quick DB sanity check: find which table/column shows -2h (e.g., users.created_at)
- [ ] Execute SQL checks: SHOW timezone; compare created_at, created_at AT TIME ZONE UTC, created_at AT TIME ZONE Europe/Paris
- [ ] Fix root cause in migrations:
  - [ ] Update 000013_use_timestamptz_for_instant_timestamps.up.sql casts/defaults to avoid double timezone conversion (prefer NOW()/CURRENT_TIMESTAMP without AT TIME ZONE for timestamptz)
  - [ ] Update related defaults like 000011_user_event_preferences_audit_timestamps.up.sql if needed
- [ ] (Optional but recommended) Correct existing rows by shifting by the detected offset only once
- [ ] Run backend tests / start app and re-check a couple of timestamps

