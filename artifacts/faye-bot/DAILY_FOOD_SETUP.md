# Daily foodie photos

Faye posts one random real food photo in the home server's foodie channel at
**12:00 PM America/Chicago** each day. The message says:

> Would you eat this? Yes or no?

This is a normal message with a photo embed and source credit. There is no native
poll, reaction voting, or role ping. Members can answer in chat.

The existing `DISCORD_GUILD_ID` selects the home server. Channel names are matched
as `foodie` or `foodies`, ignoring decorative emoji and punctuation. If multiple
channels match, no message is sent. Set optional `FOODIE_CHANNEL_ID` to select an
exact channel. Faye needs View Channel, Send Messages, and Embed Links there.

TheMealDB supplies the photos. Recent 60 posted meal IDs are excluded. Startup
checks the channel and provider without posting a test. Check Railway logs for
`daily-food: destination` and `daily-food: image provider ready`.

A database claim prevents duplicate posts across restarts or replicas. Provider
failures retry during the 15 minutes after noon. Once a Discord send is attempted,
an uncertain result retains the claim to prevent double-posting. Inspect that
day's `daily_image_posts` row and the channel before manually retrying. Old missed
days are not backfilled.
