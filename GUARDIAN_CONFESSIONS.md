# Weekly Guardian Confessions

Faye manages one weekly confession for herself and one for Lilith. Each character has a separate saved random posting time and a 26-line bank. The scheduler checks once per minute, plans the current and next UTC Monday–Sunday week, and skips expired weeks after downtime.

Both use `publishConfession`, the same submission service as `/confess submit`. Confessions receive IDs in `faye_confessions`, the normal Anonymous footer, and the existing Reply Anonymously button. `/confess reply` and the reply modal handle these just like member submissions. The private author fields identify Faye or Lilith; their names are not displayed in the public confession. No members are pinged and no member confessions are used as material.

Faye uses her configured confessions channel, with the existing environment/name fallback. Faye needs View Channel and Send Messages. Embed Links is optional: the service uses plain text with the same reply button if embeds are unavailable. `LILITH_BOT_ID` records Lilith's identity internally.

Set `GUARDIAN_CONFESSIONS_ENABLED=false` on Faye and restart to disable both. Faye retains her existing `faye_guardian_confession_posts` schedules. Lilith's new schedules live in `faye_lilith_guardian_confession_posts` in Faye's database. Her former standalone scheduler is no longer started; its historical data is retained.

Posting claims are atomic across replicas and restarts. An ambiguous send failure is not retried automatically, to prevent duplicate posts. A failed send or crash after claiming can skip that week's confession; inspect the logs and stored status if a post is missing.
