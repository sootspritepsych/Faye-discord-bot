import { Collection, ChatInputCommandInteraction } from "discord.js";
import * as confess from "./confess";
import * as suggest from "./suggest";
import * as qotd from "./qotd";
import * as sticky from "./sticky";
import * as reminder from "./reminder";
import * as setup from "./setup";
import * as faye from "./faye";
import * as help from "./help";
import * as about from "./about";
import * as wisdom from "./wisdom";
import * as modlog from "./modlog";
import * as warn from "./warn";
import * as warnings from "./warnings";
import * as timestamp from "./timestamp";
import * as vcactive from "./vcactive";
import * as askfaye from "./askfaye";
import * as naturefact from "./naturefact";
import * as unavaatu from "./unavaatu";

export interface Command {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: { toJSON(): Record<string, any>; name: string };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const commandList: Command[] = [
  confess, suggest, qotd, sticky, reminder, setup,
  faye, help, about, wisdom,
  modlog, warn, warnings,timestamp, vcactive, askfaye, naturefact, unavaatu,
];

export const commands = new Collection<string, Command>();
for (const cmd of commandList) {
  commands.set(cmd.data.name, cmd);
}

export const commandsArray = commandList.map((cmd) => cmd.data.toJSON());
