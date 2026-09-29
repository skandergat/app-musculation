# LIFTELY store privacy inventory

This is the implementation-based inventory for completing Apple App Privacy and Google Play Data safety. Verify it against the final Render, SMTP, analytics, crash reporting, service-log, and backup settings before submitting a store form.

| Data | Why it is processed | Where it is stored |
| --- | --- | --- |
| Name, email address, account creation date | Create and identify the account; email confirmation and account recovery | LIFTELY SQLite database on the configured Render persistent disk; name and address are also sent to the SMTP processor with the temporary action link |
| Password | Account authentication | Only a salted PBKDF2-HMAC-SHA256 hash is stored |
| Session token | Keep the user signed in | Native app secure storage; browser local storage on web; only a SHA-256 hash is stored by the API |
| Email action token | Confirm an email, reset a password, or authorize account deletion | Only a SHA-256 hash is stored by the API; raw token is sent by SMTP and expires |
| Email and IP rate-limit identifiers | Reduce automated email abuse | Hashed identifiers in SQLite; the email hash is removed on account deletion and IP hashes expire after at most 24 hours |
| Workouts, selected exercises, weights, repetitions, dates, and workout templates | Provide workout logging, history, and progression | LIFTELY SQLite database on the configured Render persistent disk |
| Language and dark-mode preference | Restore the user's display choices | Local app/browser storage; not sent to the API |

## Lifecycle

- New accounts are unusable until email confirmation. Unverified accounts are deleted after 7 days.
- Verification links expire after 48 hours; password reset links after 1 hour; account deletion links after 24 hours. Each link is single-use.
- Resetting a password revokes existing sessions.
- Confirmed account deletion removes the account, workout history, sets, templates, active sessions, and email action tokens from the active database.
- Backup retention is controlled by the live hosting configuration and must be confirmed before publication.
- The Google Play account-deletion web link should point to `https://<public-api-domain>/account-deletion`; publish and test this exact URL before entering it in Play Console.

## Processors and items to confirm

- Render hosts the API and database. Fill the exact region from the live service configuration.
- The selected SMTP provider sends verification, recovery, and account-deletion messages. Name it in the privacy page and store forms.
- Render may retain service and HTTP request logs according to the workspace plan; confirm the exact log data and retention period in the live account. Confirm whether backups are enabled and their retention period as well.
- No analytics or advertising SDK is present in the current mobile dependency list. Recheck if a provider is added.
- Fill the legal controller name, postal address, privacy contact, hosting region, email provider, log retention, and backup retention before presenting /privacy as final.
- Reference forms: [Apple App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy), [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-AE), and [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en). Render describes workspace log retention in its [logging documentation](https://render.com/docs/logging).

## Store form starting point (verify against the final release)

- Apple App Privacy: answer that data is collected. Candidate categories are Contact Information (name and email) and Health & Fitness (training records); both are linked to the account and used for app functionality. No advertising or tracking SDK appears in the current app source. Apple requires the policy URL and the declaration to cover the app and integrated third-party partners.
- Google Play Data safety: candidate data types are Personal info (Name, Email address, User IDs) and Health and fitness (Fitness info); purposes include App functionality and Account management. Check how to report hashed client IPs for mail-abuse limits and any live service logs. Declare collection, whether data is optional, transport encryption, and account/data deletion.
- Google Play treats a transfer to a service provider as excluded from "sharing" only when that provider processes data on the developer's behalf and instructions. Render and the selected SMTP provider may qualify; verify their live settings and terms before answering. Declare a transfer as sharing if a provider uses the data for another purpose.
- Language and dark-mode settings remain on the device and are not transmitted to the backend; Google Play's collection definition excludes data processed only on-device.
