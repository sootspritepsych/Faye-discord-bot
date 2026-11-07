# Faye native daily Discord polls 🌿

This feature lives alongside QOTD and **does not change QOTD's 2 PM America/Chicago schedule**. The default poll time is **10:00 AM America/Chicago** and adjusts for daylight saving time. Polls remain open for 24 hours and have 2–10 choices. **Each poll mentions a separate @POTD role**, not the existing @QOTD role.

## After reviewing and merging this PR

1. Make sure Railway is configured to run the `artifacts/faye-bot` start script, which now runs `migrateQotd.ts`, `migratePolls.ts`, slash-command registration, then Faye. These migrations are safe to rerun and create new poll tables without deleting existing data.
2. **Use the existing channel** with Discord channel ID `1568435643581730917`. Keep it private while testing; later make this *same channel* public through Discord channel permissions.
3. Grant Faye **View Channel**, **Send Messages**, and **Send Polls** permission in that private channel. (Send Polls is a distinct Discord permission.)
4. **No Discord setup commands are required for the first launch:** the migration selects this existing private channel automatically and imports the 35 starter polls plus 200 additional polls, then tops the approved catalog up to **365 total polls** (including any previously posted polls). As staff, run `/poll status` to check the channel, queue, and time after the Railway deployment succeeds. `/poll seed` can be run again safely, but will skip duplicates.
5. **All polls, including `/poll post`, go only to the configured private channel.** Members without permission to view that channel will not see the posts. Once the next 10 AM Central occurs, Faye will post an approved unused poll there (provided the bot has Send Polls permission). The scheduler is process-based; Railway must have Faye running to post.

## @POTD role and notification permissions

On startup, Faye looks for an existing **POTD** role and reuses it, or creates a separate one if none exists. Faye saves its role ID in the poll config. Each new member (non-bot) automatically receives @POTD from Faye's GuildMemberAdd handler. On startup, Faye also runs a **one-time backfill for existing members who already have @QOTD**, giving them @POTD without removing or changing @QOTD. This may take several minutes for a large server. The database records successful completion so restarts do not repeat the full member scan; failed individual assignments are retried on a future restart. Members without @QOTD are not added retroactively. The existing @QOTD role and QOTD pings remain unchanged.

Ensure Faye has **Manage Roles** server permission, its highest role is positioned **above POTD**, and it has **Mention @everyone, @here, and All Roles** permission in the poll channel to ping @POTD (the role is created non-mentionable to avoid uncontrolled mass pings by other members). If Faye lacks those permissions, the logs warn and new members might not receive @POTD, or the mention might not notify. The poll still posts normally.

The 200 extra polls are imported idempotently on startup using a question-level unique constraint, then a separate annual question seeder fills each approved catalog to **365 polls and 365 QOTDs** (including previously used entries). Existing entries are never deleted or overwritten, and pending member submissions remain unapproved. The seed runs within a database transaction and never posts anything. If a catalog already exceeds 365, it is left intact.

## One year's worth of daily questions

- Native polls: **365 approved total** including previously posted polls, at 10 AM Central with @POTD.
- QOTD: **365 approved total** including previously posted QOTDs, at 2 PM Central with @QOTD.
- Check counts with `/poll status` and **`/qotd status`** (both visible only to staff).
- The catalogs count **used** posts toward 365. Remaining unused posts are shown separately. To guarantee another full 365 days *starting today*, you would instead need 365 *unused* entries per catalog.
- The annual question banks contain 181 new native poll candidates and 487 new standalone QOTD candidates. Questions are deduplicated against existing used, unused, and pending submissions. Once the approved total reaches 365, no extra candidates are imported.
- Seeded questions are automatically approved but never posted immediately. Existing member-submitted QOTDs and polls are preserved, and Faye retains her independent posting schedules.

## Staff commands

`/poll add` (one approved poll), `/poll batch` (paste several approved polls), `/poll import` (upload UTF-8 .txt file up to 64 KB), `/poll seed` (the 35 starter polls), `/poll queue` (paginated), `/poll pending` (paginated member suggestions), `/poll history` (paginated past posts), `/poll approve id:`, `/poll reject id:`, `/poll remove id:`, `/poll post id:` (posts **to the configured private channel** and consumes today's slot), `/poll channel`, `/poll time`, and `/poll status`.

Members can submit suggestions with `/poll suggest`. **Staff-created/imported polls auto-approve; member-submitted polls require staff approval.** Previously submitted or used questions are skipped as duplicates.

Import one poll per line with `|` separating question and 2–10 answers:

```text
Which is the best cozy activity? | Reading | Gaming | Crafting | Movies
Choose your fantasy pet! | Dragon | Owl | Familiar cat | Phoenix
```

All slash commands return private responses, except `/poll post` which intentionally posts a native poll message to the configured channel (private during testing). `/poll seed` is a particularly easy mobile-first way to fill the queue.

## Making the same channel public later

The private testing channel **ID `1568435643581730917` stays the polling channel**. When ready to launch publicly, change that **same channel's Discord visibility/permissions** to allow members to view it. Do **not** switch to another channel or rerun `/poll channel`. Faye will keep posting in the same channel ID automatically.

**Important:** When the channel becomes visible to members, existing test polls and their results may become visible too if members have permission to read message history. Delete any unwanted test posts before opening the channel. Changing channel visibility does not clear its message history.

## Operational notes

- The poll system has its own `faye_poll_config`, `faye_poll_entries`, and `faye_daily_poll_posts` PostgreSQL tables.
- A daily unique database claim prevents duplicate automatic posts during restart or concurrent workers, and posted polls stay in the database to prevent repeats.
- If a Discord send fails after a daily claim, that claim **remains** to avoid accidental duplicates. Inspect channel history and Railway logs before attempting manual recovery.
- If Faye restarts up to two hours after today's scheduled time, the scheduler attempts a same-day catch-up. It never posts before its configured time.
- No new npm dependencies or environment variables are required.
- Updates deploy automatically from `main` to Railway when merged. Review GitHub checks and Railway logs after merging.
