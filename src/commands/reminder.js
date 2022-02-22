import dayjs from "dayjs";
import "dayjs/locale/fr.js";
import Duration from "dayjs/plugin/duration.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
import { addReminder, removeReminder, updateReminder } from "../helpers/dbHelper.js";
dayjs.locale("fr");
dayjs.extend(Duration);
dayjs.extend(relativeTime);

import personnalities from "../personnalities.json";

const PERSONNALITY = personnalities.normal;

const addClientReminder = (client, authorId, botMessage, timeoutObj) => {
  client.remindme.push({
    authorId: authorId,
    botMessage: botMessage,
    timeout: timeoutObj,
  });
};

export const initReminder = async (client) => {
  const db = client.db;
  if (db.data && db.data.reminder.length > 0)
    db.data.reminder.forEach(async (element) => {
      const author = await client.users.fetch(element.authorId); // Find user
      const channel = await client.channels.fetch(element.channelId); //Find channel
      const botMessage = await channel.messages.fetch(element.answerId); //Find bot response

      const now = dayjs();
      const difference = element.timing - now.diff(dayjs(element.startingTime));
      const newTiming = difference > 0 ? difference : 10000;

      const timeoutObj = setTimeout(
        sendDelayed,
        newTiming,
        client,
        channel,
        author,
        element.content,
        botMessage
      );

      addClientReminder(client, author.id, botMessage, timeoutObj);
      updateReminder(db, botMessage.id, now.toISOString(), newTiming);
    });
};

const sendDelayed = async (
  client,
  channel,
  author,
  messageContent,
  botMessage
) => {
  try {
    await author.send(`${author.toString()} : ${messageContent}`); //MP
  } catch {
    await channel.send(`${author.toString()} : ${messageContent}`);
  }
  client.remindme = client.remindme.filter(
    ({ botMessage: answer }) => answer.id !== botMessage.id
  );
  removeReminder(client.db, botMessage.id);
};

const formatMs = (nbr) => {
  return dayjs.duration(nbr, "milliseconds").humanize();
};

const extractDuration = (str) => {
  const lowerStr = str.toLowerCase();

  // XXhYYmZZs

  const hours = Number(lowerStr.slice(0, 2));
  const minutes = Number(lowerStr.slice(3, 5));
  const seconds = Number(lowerStr.slice(6, 8));

  const durationMs =
    (isNaN(hours) ? 0 : hours * 3600) +
    (isNaN(minutes) ? 0 : minutes * 60) +
    (isNaN(seconds) ? 0 : seconds);

  return durationMs * 1000;
};

const answerBot = async (message, personality, currentServer, timing) => {
  try {
    const answer = await message.author.send(
      personality.reminder.remind.concat(
        `${formatMs(timing)}`,
        personality.reminder.react[0],
        `${currentServer.removeEmoji}`,
        personality.reminder.react[1]
      )
    );
    await answer.react(currentServer.removeEmoji);
    return answer;
  } catch {
    console.log(`Utilisateur ayant bloqué les DMs`);
    const answer = await message.reply(
      personality.reminder.remind.concat(
        `${formatMs(timing)}`,
        personality.reminder.react[0],
        `${currentServer.removeEmoji}`,
        personality.reminder.react[1]
      )
    );
    await answer.react(currentServer.removeEmoji);
    return answer;
  }
};

const action = async (message, personality, client, currentServer) => {
  const { channel, content, author } = message;
  const args = content.split(" ");
  const wordTiming = args[1];

  const timing = extractDuration(wordTiming);

  if (!timing) {
    console.log("erreur de parsing");
  } else {
    console.log("timing: ", timing);

    const messageContent = args.slice(2).join(" ");

    const answer = await answerBot(message, personality, currentServer, timing);

    const date = dayjs().toISOString();

    const timeoutObj = setTimeout(
      sendDelayed,
      timing,
      client,
      channel,
      author,
      messageContent,
      answer
    );

    addClientReminder(client, author.id, answer, timeoutObj);

    addReminder(client.db, message, answer.id, timing, date, messageContent);
  }
};

const reminder = {
  name: "reminder",
  action,
  help: () => {
    return PERSONNALITY.commands.reminder.help;
  },
  admin: false,
};

export default reminder;
