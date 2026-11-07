# Faye native daily Discord polls 🌿

This feature lives alongside QOTD and **does not change QOTD's 2 PM America/Chicago schedule**. The default poll time is **10:00 AM America/Chicago** and adjusts for daylight saving time. Polls remain open for 24 hours, have 2–10 choices, and send no role pings.

## After reviewing and merging this PR

1. Make sure Railway is configured to run the `artifacts/faye-bot` start script, which now runs `migrateQotd.ts`, `migratePolls.ts`, slash-command registration, then Faye. These migrations are safe to rerun and create new poll tables without deleting existing data.
2. Make a dedicated text channel named `#daily-polls` in Discord.
3. Grant Faye **View Channel**, **Send Messages**, and **Send Polls** permission there. (Send Polls is a distinct Discord permission.)
4. As an admin with **Manage Server** permission, run:
    - `/poll channel channel:#daily-polls`
    - `/poll time time:10:00` (optional; this is the default)
    - `/poll seed` (adds 35 mixed starter polls without using a file)
    - `/poll status`
5. Once the next 10 AM Central occurs, Faye will post an approved unused poll. The scheduler is process-based; Railway must have Faye running to post.

## Staff commands

`/poll add` (one approved poll), `/poll batch` (paste several approved polls), `/poll import` (upload UTF-8 .txt file up to 64 KB), `/poll seed` (the 35 starter polls), `/poll queue` (paginated), `/poll pending` (paginated member suggestions), `/poll history` (paginated past posts), `/poll approve id:`, `/poll reject id:`, `/poll remove id:`, `/poll post id:` (posts **publicly** and consumes today's slot), `/poll channel`, `/poll time`, and `/poll status`.

Members can submit suggestions with `/poll suggest`. **Staff-created/imported polls auto-approve; member-submitted polls require staff approval.** Previously submitted or used questions are skipped as duplicates.

Import one poll per line with `|` separating question and 2–10 answers:

```text
Which is the best cozy activity? | Reading | Gaming | Crafting | Movies
Choose your fantasy pet! | Dragon | Owl | Familiar cat | Phoenix
```

All commands reply privately, except `/poll post` which intentionally publishes a poll into the configured channel. `/poll seed` is a particularly easy mobile-first way to fill the queue.

## Operational notes

- The poll system has its own `faye_poll_config`, `faye_poll_entries`, and `faye_daily_poll_posts` PostgreSQL tables.
- A daily unique database claim prevents duplicate automatic posts during restart or concurrent workers, and posted polls stay in the database to prevent repeats.
- If a Discord send fails after a daily claim, that claim **remains** to avoid accidental duplicates. Inspect channel history and Railway logs before attempting manual recovery.
- If Faye restarts up to two hours after today's scheduled time, the scheduler attempts a same-day catch-up. It never posts before its configured time.
- No new npm dependencies or environment variables are required.
- This PR has not been deployed. Review or test before merging to the Railway-connected branch.
