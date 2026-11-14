# LIFTELY — GDPR readiness audit (working document)

Status: technical preparation only; this is not a legal compliance certification or a published privacy notice.

## Verified in the current backend source
- User records contain name, email, password hash, account creation date, and email verification timestamp.
- Passwords are hashed with Argon2id; legacy PBKDF2 hashes are supported for migration.
- Session tokens are stored as SHA-256 hashes; session lifetime is configured to 30 days.
- Email verification tokens expire after 48 hours; password-reset tokens after 1 hour; account-deletion tokens after 24 hours.
- Unverified accounts are configured for cleanup after 7 days. Expired action tokens and rate-limit records are periodically purged.
- Email delivery can be configured through Brevo API or SMTP environment variables.
- The API exposes account/session/workout data through a custom authenticated backend; the app uses a PostgreSQL/SQLite compatibility layer.

## Must be completed before public MVP
1. Identify the legal data controller: full legal name, postal address, contact email, and (if applicable) DPO contact.
2. Publish a privacy notice describing purposes, legal bases, categories of data, recipients/processors, retention periods, user rights, complaint route to CNIL, and international transfers.
3. Confirm the exact personal data collected by mobile screens, analytics, crash reporting, push notifications, logs, and support flows.
4. Define retention periods for verified accounts, workout history, deleted accounts, backups, security logs, and support records. The 30-day session TTL is not a data-retention policy.
5. Implement and test data export, account deletion, deletion propagation to templates/sessions/workouts, and backup expiry.
6. Record processor agreements and sub-processors: Supabase, Render, Brevo, Expo/EAS, app analytics/crash tools, and any other active provider.
7. Confirm hosting regions, transfer mechanisms, access controls, encryption, incident response, and breach-notification procedure.
8. Decide whether workout/body measurements can reveal health data; if so, assess GDPR Article 9 implications and the applicable exception/consent before processing.
9. Add a documented data-processing register and a DPIA screening; do not claim a DPIA is unnecessary without assessment.
10. Add a contact route for rights requests and an internal response workflow with identity verification and statutory deadlines.

## Release blockers / unknowns
- Controller identity and address are not present in the repository evidence reviewed.
- No verified public privacy-policy URL or complete terms/consent workflow has been established in this audit.
- Exact retention for production account and training data is not yet established.
- No end-to-end proof of export/deletion or backup deletion has been supplied.
- Processor DPAs and subprocessor list have not been verified here.

Do not publish this working document as the user-facing privacy notice. Fill the missing legal facts and obtain qualified review before release.