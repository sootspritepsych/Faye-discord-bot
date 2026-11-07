import { PermissionFlagsBits, type Client } from "discord.js";
import { pool } from "./database";
import { allPollConfigs } from "./pollService";
import { ensurePotdRole } from "./potdRoleService";
import { QOTD_ROLE_ID } from "./qotdService";

/**
 * One-time, resumable migration of existing QOTD subscribers to POTD.
 *
 * Newly joining members are handled separately by guildMemberAdd.
 * A completion marker is saved only after every eligible role grant succeeds,
 * so interrupted migrations retry missing members after a restart.
 */
export async function backfillPotdForQotdMembers(client: Client): Promise<void> {
  const configs = await allPollConfigs();
  for (const config of configs) {
    if (!config.channel_id) continue;
    try {
      const guild = client.guilds.cache.get(config.guild_id);
      if (!guild) {
        console.warn("🗳️ POTD backfill skipped: guild not in cache " + config.guild_id);
        continue;
      }

      const done = await pool.query(
        "SELECT 1 FROM faye_potd_role_backfill WHERE guild_id=$1",
        [guild.id]
      );
      if (done.rowCount) continue;

      const qotd = await guild.roles.fetch(QOTD_ROLE_ID).catch(() => null);
      if (!qotd) {
        console.warn("🗳️ POTD backfill skipped: QOTD role not found in " + guild.name);
        continue;
      }
      const potd = await ensurePotdRole(guild);
      if (!potd) continue;

      const me = guild.members.me ?? await guild.members.fetchMe();
      if (!me.permissions.has(PermissionFlagsBits.ManageRoles) ||
          me.roles.highest.comparePositionTo(potd) <= 0) {
        console.warn(
          "⚠️ POTD backfill paused: Faye needs Manage Roles and must be above POTD in role order."
        );
        continue;
      }

      console.log("🗳️ POTD backfill: fetching existing QOTD subscribers in " + guild.name);
      // Requires the Guild Members privileged intent in Discord's developer portal.
      const members = await guild.members.fetch();
      let assigned = 0;
      let already = 0;
      let failed = 0;
      for (const member of members.values()) {
        if (member.user.bot || !member.roles.cache.has(QOTD_ROLE_ID)) continue;
        if (member.roles.cache.has(potd.id)) {
          already++;
          continue;
        }
        try {
          await member.roles.add(potd, "Initial POTD opt-in for existing QOTD subscribers");
          assigned++;
          if (assigned % 50 === 0) {
            console.log("🗳️ POTD backfill progress: " + assigned + " members assigned");
          }
        } catch (error) {
          failed++;
          console.error("❌ POTD backfill: failed for member " + member.id, error);
        }
      }

      if (failed === 0) {
        await pool.query(
          "INSERT INTO faye_potd_role_backfill (guild_id,synced_count) VALUES ($1,$2) " +
          "ON CONFLICT (guild_id) DO NOTHING",
          [guild.id, assigned + already]
        );
      }
      console.log(
        "🗳️ POTD backfill complete for " + guild.name +
        ": " + assigned + " added, " + already + " already had POTD, " +
        failed + " failed" + (failed ? " (will retry on next restart)" : "")
      );
    } catch (error) {
      console.error("❌ POTD backfill failed; will retry after next restart", error);
    }
  }
}
