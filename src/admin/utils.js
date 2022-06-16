import { MessageEmbed } from "discord.js";
import { PERSONALITY } from "../personality.js";

// jsons imports
import { readFileSync } from "fs";
const commons = JSON.parse(readFileSync("static/commons.json"));

export const fetchAuditLog = async (guild, auditType) => {
  //fetch the first corresponding audit log
  const fetchedLogs = await guild.fetchAuditLogs({
    limit: 1,
    type: auditType,
  }); //fetch logs
  return fetchedLogs.entries.first(); //return the first
};

export const finishEmbed = async (
  personalityEvent,
  executor,
  embed,
  logChannel,
  text,
  attachments
) => {
  //Finish the embed and send it
  if (embed.author !== null) {
    //embed.data is a embed property & not an array property
    //if contains multiple embeds, the 1st is the log
    embed[0].addField(personalityEvent.executor, executor, true); //add the executor section
    if (text) embed[0].addField(personalityEvent.text, text, false); //if any text (reason or content), add it

    await logChannel.send({ embeds: embed }); //send
    if (attachments) await logChannel.send({ files: attachments }); //if attachments, send new message
    return;
  }

  embed.addField(personalityEvent.executor, executor, true);
  if (text) embed.addField(personalityEvent.text, text, false); //if any text (reason or content), add it

  await logChannel.send({ embeds: [embed] }); //send
  if (attachments) await logChannel.send({ files: attachments }); //if attachments, send new message
};

export const getLogChannel = async (commons, eventObject) => {
  const currentServer = commons.find(
    ({ guildId }) => guildId === eventObject.guild.id
  ); //get server local data
  return await eventObject.guild.channels.fetch(currentServer.logChannelId); //return the log channel
};

export const setupEmbed = (color, personality, object, type, auditPerso) => {
  //setup the embed object
  const embed = new MessageEmbed()
    .setColor(color)
    .setTitle(personality.title)
    .setTimestamp();

  if (personality.description) embed.setDescription(personality.description);

  if (type === "tag") {
    //add the user tag if required
    embed.addField(personality.author, object.tag, true);
  } else if (type === "Partial") embed.addField(type, auditPerso.partial);
  else embed.addField(personality.author, object.name, true); //otherwise, add the object name (for channels, roles, ...)
  return embed;
};

export const endAdmin = (
  object,
  log,
  eventPerso,
  logPerso,
  embed,
  logChannel,
  reason,
  diff
) => {
  if (diff >= 5) {
    //if log too old
    finishEmbed(eventPerso, logPerso.tooOld, embed, logChannel);
    return;
  }

  if (!log) {
    //if no AuditLog
    finishEmbed(eventPerso, logPerso.noLog, embed, logChannel, reason);
    return;
  }

  const { executor, target } = log;

  if (target.id === object.id) {
    //check if log report the correct kick
    finishEmbed(eventPerso, executor.tag, embed, logChannel, reason);
  } else {
    //if bot or author executed the kick
    finishEmbed(eventPerso, logPerso.noExec, embed, logChannel, reason);
  }
};

export const clientChannelUpdateProcess = (client, oldChannel, newChannel) => {
  /* create timeout
   * store channels, timeout */
  const timeout = setTimeout(channelUpdateLog, 5000, client, newChannel); //create timeout

  //handle client
  const channelUpdate = client.channelUpdate
  const channels = channelUpdate ? channelUpdate.channels : null; //get data
  const newData = {
    id: newChannel.id,
    name: oldChannel.name,
    oldPos: oldChannel.rawPosition,
    newPos: newChannel.rawPosition,
  };

  const updateData = channels
    ? { channels: [...channels, newData], timeout: timeout }
    : { channels: [newData], timeout: timeout }; //add

  client.channelUpdate = updateData; //store
};

const channelUpdateLog = async (client, newChannel) => {
  //Function called after channelUpdate timeout end
  const { channels } = client.channelUpdate;

  //create old/new channel order
  const oldOrder = channels.sort((a, b) => a.oldPos - b.oldPos).slice(); //sort channels with oldPosition
  const newOrder = channels.sort((a, b) => a.newPos - b.newPos).slice();

  //personality
  const personality = PERSONALITY.getAdmin();
  const chnUp = personality.channelUpdate;
  const logPerso = personality.auditLog;

  const logChannel = await getLogChannel(commons, newChannel); //get logChannelId

  //embed
  const embed = new MessageEmbed()
    .setColor("DARK_AQUA")
    .setTitle(chnUp.title)
    .setTimestamp();

  //text
  const orderText = oldOrder.reduce((acc, cur, idx) => {
    const spaced = space2Strings(cur.name, newOrder[idx].name, 25, " | ");
    if (idx === oldOrder.length - 1) return acc + "\n" + spaced + "\n```";
    return acc + "\n" + spaced;
  }, "```md\n" + space2Strings("avant", "apres", 25, " | ") + "\n");

  finishEmbed(chnUp, logPerso.noLog, embed, logChannel, orderText); //send embed
};

const space2Strings = (str1, str2, dist, sep) => {
  const sliced1 = str1.slice(0, dist).padEnd(dist, " ");
  const sliced2 = str2.slice(0, dist).padEnd(dist, " ");

  return `${sliced1}${sep}${sliced2}`;
};
