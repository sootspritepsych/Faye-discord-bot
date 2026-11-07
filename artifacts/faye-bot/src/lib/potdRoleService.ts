import {
  type Client,
  type Guild,
  type GuildMember,
  PermissionFlagsBits,
  type Role,
} from "discord.js";
import { pool } from "./database";
import { allPollConfigs, pollConfig } from "./pollService";
import { QOTD_ROLE_ID } from "./qotdService";

/**
 * A separate role for native daily polls. QOTD uses its own existing role.
 * The role remains non-mentionable for ordinary members; Faye needs the
 * MentionEveryone permission in the poll channel to ping it.
 */
export async function ensurePotdRole(guild: Guild): Promise<Role | null> {
  const config = await pollConfig(guild.id);
  if (!config?.channel_id) return null;

  // Fetch roles to avoid creating a duplicate if the role existed before a restart.
  await guild.roles.fetch();
  let role: Role | null =
    (config.potd_role_id ? guild.roles.cache.get(config.potd_role_id) : null) ??
    guild.roles.cache.find(r => r.name.toLowerCase() === "potd" && !r.managed) ??
    null;

  if (!role) {
    const me = guild.members.me ?? await guild.members.fetchMe();
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      console.warn("⚠️ POTD role missing: Faye needs Manage Roles in guild " + guild.id);
      return null;
    }
    role = await guild.roles.create({
      name: "POTD",
      mentionable: false,
      hoist: false,
      reason: "Dedicated notification role for Garden of Harmony daily polls",
    });
    console.log("🗳️ Created @POTD role in " + guild.name + ": " + role.id);
  }

  if (config.potd_role_id !== role.id) {
    await pool.query(
      "INSERT INTO faye_poll_config (guild_id,potd_role_id) VALUES ($1,$2) " +
      "ON CONFLICT (guild_id) DO UPDATE SET potd_role_id=EXCLUDED.potd_role_id",
      [guild.id, role.id]
    );
  }
  return role;
}

export async function initializePotdRoles(client: Client): Promise<void> {
  const configs = await allPollConfigs();
  for (const config of configs) {
    if (!config.channel_id) continue;
    try {
      const guild = await client.guilds.fetch(config.guild_id);
      await ensurePotdRole(guild);
    } catch (error) {
      console.error("❌ Failed to initialize @POTD for guild " + config.guild_id, error);
    }
  }
}

/**
 * One-time migration: give POTD to all members who already have QOTD.
 * Tracks successful completion in Postgres so a bot restart will not
 * unnecessarily re-fetch the entire server. Failed grants are retried.
 */
export async function backfillExistingQotdMembers(client: Client): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS faye_potd_role_backfill (
      guild_id TEXT PRIMARY KEY,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const configs = await allPollConfigs();
  for (const config of configs) {
    if (!config.channel_id) continue;
    try {
      const done = await pool.query(
        "SELECT 1 FROM faye_potd_role_backfill WHERE guild_id = $1",
        [config.guild_id]
      );
      if (done.rowCount) continue;

      const guild = await client.guilds.fetch(config.guild_id);
      // Do not mark a guild complete if its QOTD role cannot be found.
      const qotdRole = await guild.roles.fetch(QOTD_ROLE_ID).catch(() => null);
      if (!qotdRole) {
        console.warn("⚠️ POTD backfill skipped; QOTD role missing in " + guild.id);
        continue;
      }
      const potdRole = await ensurePotdRole(guild);
      if (!potdRole) continue;

      const me = guild.members.me ?? await guild.members.fetchMe();
      if (!me.permissions.has(PermissionFlagsBits.ManageRoles) ||
          me.roles.highest.comparePositionTo(potdRole) <= 0) {
        console.warn("⚠️ POTD backfill needs Manage Roles and Faye above POTD in " + guild.id);
        continue;
      }

      console.log("🗳️ Starting one-time POTD backfill for " + guild.name);
      const members = await guild.members.fetch();
      let assigned = 0;
      let failed = 0;
      for (const member of members.values()) {
        if (!member.roles.cache.has(QOTD_ROLE_ID) || member.roles.cache.has(potdRole.id)) {
          continue;
        }
        try {
          await member.roles.add(potdRole, "One-time POTD migration from QOTD");
          assigned++;
          if (assigned % 50 === 0) {
            console.log("🗳️ POTD: assigned to " + assigned + " existing members");
          }
        } catch (error) {
          failed++;
          console.error("Could not assign POTD to existing member " + member.id, error);
        }
      }

      if (failed === 0) {
        await pool.query(
          "INSERT INTO faye_potd_role_backfill (guild_id) VALUES ($1) ON CONFLICT DO NOTHING",
          [guild.id]
        );
      }
      console.log("🗳️ POTD backfill: " + assigned + " assigned, " + failed + " failed.");
      if (failed) {
        console.warn("POTD backfill will retry failed assignments on the next restart.");
      }
    } catch (error) {
      console.error("❌ POTD backfill failed for " + config.guild_id, error);
    }
  }
}

export async function assignPotdRole(member: GuildMember): Promise<void> {
  const config = await pollConfig(member.guild.id);
  if (!config?.channel_id || member.user.bot) return;
  const role = await ensurePotdRole(member.guild);
  if (!role || member.roles.cache.has(role.id)) return;

  const me = member.guild.members.me ?? await member.guild.members.fetchMe();
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles) ||
      me.roles.highest.comparePositionTo(role) <= 0) {
    console.warn("⚠️ Cannot assign @POTD: grant Faye Manage Roles and move its role above POTD");
    return;
  }
  await member.roles.add(role, "Daily poll notifications for newly joined members");
  console.log("🗳️ Assigned @POTD to new member " + member.id);
}
