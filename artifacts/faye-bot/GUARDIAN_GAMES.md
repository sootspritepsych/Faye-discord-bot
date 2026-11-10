# Play with the Guardians

Choose Faye's commands for these games:

| Command | What it does |
| --- | --- |
| `/compliment user:@member about:helping newcomers` | Faye celebrates a member. Both options are optional. |
| `/duality user:@member` | A Faye compliment and Lilith commentary, labeled together in one Faye embed. |
| `/gift user:@member item:tea note:Thank you!` | Give a decorative keepsake. Omit user to see received gifts privately. |
| `/fortune sister:Faye` | A saved daily fortune from either sister. |
| `/ask-sisters question:What should I read?` | Both perspectives, labeled together in one Faye embed. |
| `/vibe user:@member` | A playful garden aura that changes daily. |
| `/explore location:pond` | Find encounters and saved keepsakes. Three journeys per UTC day. |
| `/explore action:bag` | View your keepsake bag privately. |
| `/tea sister:Lilith topic:My favorite books` | Start a ten-minute public tea chat. Use the reply button to continue. |
| `/wish text:A peaceful week` | Leave one public wish per UTC day with an encouragement button. |

Choose **Lilith's** `/roast user:@member topic:collecting side quests` for a playful roast sent by Lilith herself. Both options are optional. Lilith retains the existing home/paid-server license restrictions.

Targeted commands default to yourself except gifts, which require another human member. Wishes and tea chats are visible in their channel; only the tea-chat owner can continue their session. Each member can encourage another member's wish once. Encouragement totals appear in the supporter's private confirmation.

Most commands allow one use per 30-second UTC window; Lilith's roast uses a rolling 30-second cooldown. Tea replies allow one reply per 15-second window. Daily limits reset at midnight UTC. Gifts and finds are decorative; these commands do not award garden points or spend existing currency.

Fortunes, gifts, discoveries, wishes, support, cooldowns, and tea context persist in PostgreSQL and are scoped to the server. Public responses use supplied command input and the current tea session, never saved private memories or unrelated chat history. AI responses have local fallbacks. Exploration uses five curated encounters that preserve the mystery of the sisters' origins.
