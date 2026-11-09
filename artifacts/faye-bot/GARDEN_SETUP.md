# 🌳 Garden of Harmony — Shared Tree & Community Garden

This is a **separate, opt-in community system**, not the server's existing chat/voice XP, casino economy, or Faye's private DM rapport.

## What is included

- One persistent server tree that evolves through six growth stages.
- A public Top Gardener ranking, plus separate **Most Chats** and **Most Emoji Reactions Given** rankings for **today**, **this week (Monday to Sunday)**, and **this month**, using America/Chicago boundaries.
- Flowers, vegetables and greenery: sunflower, tulip, rose, lavender, tomato, carrot, pumpkin, fern.
- One plant per user per day. A member can water their own or another member's plant using its ID. Three waterings mature a plant; only its owner can harvest it.
- Christmas ornaments (star, colored baubles, snowflake, ribbon, lights), one per member per day in November–January.
- A shared tree contribution total that includes chat/reaction activity and tending the garden.
- Opt-in via staff-only `/garden enable`. No historical posts are processed; data is stored only after enabling.

## Discord commands

| Command | Purpose |
| --- | --- |
| `/garden enable` / `/garden disable` | Staff-controlled feature toggle, keeping data when paused |
| `/garden setchannel channel:#garden-updates` | Staff: choose a public channel for activity announcements |
| `/garden view` | Shared tree, growth progress, top day/week/month gardeners |
| `/garden leaderboard period:day category:chat` | Ten most active eligible chatters today |
| `/garden leaderboard period:week category:reaction` | Ten most active emoji reactors this week |
| `/garden leaderboard period:month category:all` | Total community gardener ranking this month |
| `/garden plant species:tomato` | Plant a flower, vegetable, or fern |
| `/garden plants` | List plots, owners and watering progress |
| `/garden water plant_id:123` | Help mature a plant |
| `/garden harvest plant_id:123` | Harvest your mature plant |
| `/garden decorate ornament:star` | Add a holiday decoration |
| `/garden stats` | Your contribution statistics |

## Public activity announcements

Whenever someone successfully **plants, waters, harvests, or decorates**, Faye sends a colorful public embed celebrating the contribution and the tree's new growth points. Failed/limited actions still receive a private response only. These updates do **not** ping everyone or any role.

- Use `/garden setchannel channel:#garden-updates` as a member with **Manage Server** to send all success announcements to a shared, publicly viewable channel.
- Until a channel is configured, the bot posts public updates into the channel where members run the garden commands.
- For fairness and to avoid spam in a large server, ordinary chats and emoji reactions contribute to garden totals silently; they do **not** each trigger a new announcement.
- Announcement failures don't undo a successful garden action or award points twice.
- Dashboard updates remain automatic and separate from these Discord messages.

## Anti-spam and scoring

- Eligible chat: at least 8 non-link characters (or attachment), not a command; one credited chat every 45 seconds, up to 60 credited chats daily.
- Emoji reactions: credits **the user who reacts**, not the message author; only one reaction credited per message/user, one every 25 seconds, up to 35 credited reactions daily.
- Self reactions and bot reactors are ignored. Reacting to a bot's QOTD is okay. Discord's native poll votes are **not** Discord emoji reactions.
- Planting: +5 tree points; watering: +3; harvesting: +5; ornament: +3; credited chat or reaction: +1.
- Those anti-spam limits deliberately make leaderboards represent healthy participation instead of unlimited raw message counts.
- All tables are scoped by `guild_id`. No message content, attachment, member nickname, or DM text is stored in the garden system.
- Existing XP-bottle and casino roles/currency **are not modified**.

## Deployment and setup

1. Review the `feature/community-garden-tree` PR, then merge into the Faye repo's main branch.
2. Railway's existing bot start script runs `migrateGarden.ts` after the QOTD and poll migrations, and registers the new slash commands.
3. In the bot's Discord Developer Portal, enable the privileged Guild Members/Message Content intents **if they are needed for the existing bot**, and ensure the bot has View Channel/Read Message History and standard message/reaction access in the channels being counted. `GuildMessageReactions` is enabled in bot code.
4. Test the new commands with a staff account. By default the garden is **off**, so the bot does not start counting until `/garden enable`.
5. Test a chat, a reaction, planting a seed, watering and the leaderboards.

## Live dashboard integration

**The active separate Railway service is `dashboard-faye` → `garden-of-harmony`**, sourced from GitHub repo `sootspritepsych/garden-of-harmony`, branch `portal-redesign`, and served at `https://gardenofharmony.up.railway.app`.

This repository is **not currently available to the linked GitHub app**, so this PR does not modify that dashboard. Grant the GitHub connection access to `sootspritepsych/garden-of-harmony` before editing it directly.

The current dashboard project already has a `DATABASE_URL` variable. **Verify** it points to the same PostgreSQL instance as Faye's `DATABASE_URL`; merely having the same variable name is not proof. No database credentials should be sent to users or included in client-side JavaScript.

### Server-side dashboard queries

Create a Next.js route `/api/garden` using the dashboard's existing server-side database client and the tables above. Return these read-only fields:

- **Tree:** `SELECT coalesce(sum(points),0) AS points FROM faye_garden_activity WHERE guild_id=$1`; map growth totals to `[0,100,500,1500,4000,10000]`.
- **Top gardeners:** `SELECT user_id, sum(points) AS score FROM faye_garden_activity WHERE guild_id=$1 AND created_at >= (date_trunc('week', now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago') GROUP BY user_id ORDER BY score DESC LIMIT 10`. Change `week` to `day` or `month`, and add `AND kind='chat'` or `AND kind='reaction'` for the other rankings.
- **Plant beds:** `SELECT id, owner_id, species, water_count FROM faye_garden_plants WHERE guild_id=$1 AND harvested_at IS NULL ORDER BY planted_at DESC LIMIT 100`.
- **Seasonal ornaments:** `SELECT id, user_id, decoration FROM faye_garden_ornaments WHERE guild_id=$1 AND season=$2 ORDER BY id LIMIT 300`, with `season` set to the current Christmas season (January belongs to the prior year).

On the dashboard, poll the **server-side** `/api/garden` route every 15–30 seconds. Never call PostgreSQL from the browser. Render different tree illustrations or CSS/SVG stages according to growth points; display planted beds and position ornaments deterministically from their IDs so the decorations don't jump around on refresh. Display a user-friendly name or avatar only after resolving the Discord IDs through authorized server-side lookup. Respect the dashboard's existing public/admin access controls.

**Suggested layout:** large interactive tree above garden beds; top three cards for Gardener of the Day, Week and Month; tabs for Most Chats and Most Emoji Reactions Given; Christmas decor appears on the tree during the season. Plant/ornament actions are handled by Faye's slash commands until the dashboard has a secured Discord sign-in/session and server-membership authorization.
