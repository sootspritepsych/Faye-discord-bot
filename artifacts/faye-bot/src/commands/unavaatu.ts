import { SlashCommandBuilder } from "discord.js";

export const unavaatuCommand = new SlashCommandBuilder()
  .setName("unavaatu")
  .setDescription("Reserve and manage Unavaatu titles.")

  .addSubcommand(subcommand =>
    subcommand
      .setName("reserve")
      .setDescription("Reserve a title.")

      .addStringOption(option =>
        option
          .setName("server")
          .setDescription("Choose the server.")
          .setRequired(true)
          .addChoices(
            { name: "Server 11", value: "11" },
            { name: "Server 40", value: "40" }
          )
      )

      .addStringOption(option =>
        option
          .setName("title")
          .setDescription("Choose the title.")
          .setRequired(true)
          .addChoices(
            { name: "Guardian of Fire", value: "Guardian of Fire" },
            { name: "General", value: "General" }
          )
      )
  );
