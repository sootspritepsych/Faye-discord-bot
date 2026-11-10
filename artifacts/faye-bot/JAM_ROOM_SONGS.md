# Jam room songs

One Spotify track posts daily at 17:00 America/Chicago during the 17:00–17:59 window. Faye starts on November 10, 2026; Lilith takes the following day, continuing every other day across months and daylight saving changes. Only the configured home guild is eligible.

`/song suggestion mood:` is registered with Faye. Options: Happy, Cozy, Sad, Energetic, Romantic, Chill, Surprise me. Run it in the jam room. The day's sister posts from her own Discord account. On Lilith's day, Faye creates a visible request card and Lilith replies to it; only fresh requests from the configured Faye bot in the home jam room are accepted. A per-user 30-second cooldown limits requests.

The starter library has 36 Spotify track links verified through Spotify oEmbed on November 10, 2026. Automatic posts draw from disjoint sister pools and shuffle least-played tracks first. Mood requests draw matching tracks from the library. Edit both `jamRoomCatalog.ts` copies together when expanding the catalogue.

Both services discover a uniquely named `jam-room` channel, ignoring emoji and separators. Optional environment settings, set consistently on both services:

- `JAM_ROOM_CHANNEL_ID`: exact channel ID if the name is ambiguous.
- `JAM_ROOM_POST_HOUR`: integer 0–23 in Central time (default 17).
- `JAM_ROOM_SONGS_ENABLED=false`: pauses automatic songs; requests still work.

Lilith's existing `FAYE_BOT_ID` must identify Faye. Both bots need View Channel and Send Messages; Faye needs Embed Links for request cards. No Spotify account or Spotify API credentials are required.

Each service creates an additive `jam_room_song_posts` table. Atomic database reservations plus Discord nonces prevent duplicate sends across restarts and overlapping deployments. If delivery is uncertain, the reservation is retained and the failure is logged rather than risking a duplicate. No automatic late-night backlog is posted.
