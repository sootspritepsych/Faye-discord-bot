import { ChatInputCommandInteraction, Collection } from "discord.js";

import * as confess from "./confess";
import * as suggest from "./suggest";
import * as qotd from "./qotd";
import * as sticky from "./sticky";
import * as reminder from "./reminder";
import * as setup from "./setup";
import * as faye from "./faye";

export interface Command {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: { toJSON(): Record<string, any>; name: string };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const commandList: Command[] = [confess, suggest, qotd, sticky, reminder, setup, faye];

export const commands = new Collection<string, Command>();
for (const cmd of commandList) {
  commands.set(cmd.data.name, cmd);
}

export const commandsArray = commandList.map((cmd) => cmd.data.toJSON());
