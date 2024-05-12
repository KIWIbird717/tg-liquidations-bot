import TelegramBot from "node-telegram-bot-api";

export const commands: TelegramBot.BotCommand[] = [
  {
    command: "menu",
    description: "Панель управления ботами",
  },
  {
    command: "add-coin",
    description: "Добавление новой монеты в список отслеживаемых",
  },
];
