import {
  type Client,
  type Guild,
  type GuildMember,
  PermissionFlagsBits,
  type Role,
} from "discord.js";
import { pool } from "./database";
import { allPollConfigs, pollConfig } from "./pollService";

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
