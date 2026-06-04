const mainChat = "<#1351497163447734294>";
const introChannel = "<#1361049562420084837>";
const selfieChannel = "<#1387139609292570634>";
const rulesChannel = "<#1436270082727743589>";
const petChannel = "<#1354650018765733998>";

const [config] = await db
  .select()
  .from(guildConfig)
  .where(eq(guildConfig.guildId, member.guild.id));

const dmMessage =
  `🌿 Hello and welcome to **Garden of Harmony**!\n\n` +
  `My name is **Faye**, the guardian spirit of this garden. 🍃\n\n` +
  `Thank you for completing onboarding and joining our little corner of the forest.\n\n` +
  `Here are a few places to explore:\n\n` +
  `🌱 **Main Chat:** ${mainChat}\n` +
  `🍄 **Introductions:** ${introChannel}\n` +
  `📸 **Selfies:** ${selfieChannel}\n` +
  `🐾 **Pet Grove:** ${petChannel}\n` +
  `📜 **Rules:** ${rulesChannel}\n\n` +
  `💚 If you ever need assistance, have questions, or aren't sure where to start, simply mention **@Faye Guides** in the server and a staff gardener will be happy to help.\n\n` +
  `May your path here be cozy, kind, and full of new friendships.\n\n` +
  `— Faye ✨`;

try {
  await member.send(dmMessage);
} catch {
  // DMs closed — fall through to welcome channel
}
