# Weekly Guardian Confessions

Each bot posts one signed, in-character confession per UTC Monday–Sunday week in the home server's confessions channel. Days and times are random and saved in Postgres; the scheduler checks once a minute. The first week's time is selected from the remaining week. The next week is planned ahead.

The 26-line character-specific banks rotate without repeating any of the most recent 25 planned lines. Posts are clearly attributed to Faye or Lilith and do not ping members. Member confessions are not read or used as material.

Faye uses her existing `/setup confessions-channel` setting. `CONFESSIONS_CHANNEL_ID` can explicitly select a channel for either bot. If neither is set, the bot accepts a single text channel named `confession` or `confessions` after removing emoji/punctuation. Ambiguous names or missing View Channel, Send Messages, or Embed Links permissions are logged and posting waits until configuration is fixed. Both bots restrict posts to their configured home server; Lilith also checks her license allowlist.

Set `GUARDIAN_CONFESSIONS_ENABLED=false` and restart to disable. Saved schedules are retained. Each bot creates its own `*_guardian_confession_posts` table at startup. Startup logs include the next planned times and channel ID.

Posting claims are atomic across replicas and restarts. Past weeks are skipped after downtime. An uncertain Discord send is not retried automatically, to avoid duplicate posts; a crash after claiming or a failed send can therefore skip that week's confession. Inspect the logs and stored status if a post is missing.
