import dotenv from "dotenv";
import { Telegraf } from "telegraf";
import { Logger } from "./utils/Logger";
import Binance from "binance-api-node";
import BinanceNode from "node-binance-api";

dotenv.config();

/** ============= Tg bot bootstrap ============= */
const tgBot = new Telegraf(process.env.API_KEY_BOT as string);
const binance = Binance();
const binanceNode = new BinanceNode();

type CoinType = {
  symbol: string;
  addTime?: Date;
  timeframe?: string; // hh:mm:ss
  liquidationBuy?: number;
  liquidationSell?: number;
  liquidations: {
    long: number;
    short: number;
  };
};
type LiquidationType = {
  symbol: string;
  side: "BUY" | "SELL";
  orderType: string;
  timeInForce: string;
  origAmount: string;
  price: string;
  avgPrice: string;
  orderStatus: string;
  lastFilledQty: string;
  totalFilledQty: string;
  eventType: string;
  tradeTime: Date | number;
  eventTime: Date | number;
};

const CoinsList = new Map<string, CoinType>();

const timeRegex: RegExp = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

tgBot.command("menu", (ctx) => {
  const menuMessage = `========== Menu ==========`;
  ctx.reply(menuMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Добавить монету", callback_data: "add_coin" }],
        [{ text: "Удалить монету", callback_data: "delete_coin" }],
        [{ text: "Список монет", callback_data: "coins_list" }],
      ],
    },
  });
});

// Объект для хранения состояний пользователей
interface UserStates {
  [userId: number]:
    | "waiting_for_coin_name"
    | "waiting_for_time_frame"
    | "waiting_for_liquidation_amount_buy"
    | "waiting_for_liquidation_amount_sell"
    | null;
}
const userStates: UserStates = {};

// Обработчик нажатия кнопки "Добавить монету"
tgBot.action("add_coin", (ctx) => {
  // Устанавливаем состояние пользователя в 'waiting_for_coin_name'
  userStates[ctx.from.id] = "waiting_for_coin_name";

  // Отправляем сообщение с просьбой ввести название монеты
  ctx.reply("Введите название монеты", {
    reply_markup: {
      inline_keyboard: [[{ text: "Отмена", callback_data: "cancel" }]],
    },
  });
});

tgBot.start((ctx) => {
  ctx.reply("Бот запущен");
  binanceNode.futuresLiquidationStream((data: LiquidationType) => {
    handleLiquidationData(data, ctx);
  });
  // setInterval(() => {
  //   const data = {
  //     symbol: "BTCUSDT",
  //     side: "BUY",
  //     orderType: "LIMIT",
  //     timeInForce: "IOC",
  //     origAmount: "1.2",
  //     price: "39.944444",
  //     avgPrice: "39.708500",
  //     orderStatus: "FILLED",
  //     lastFilledQty: "0.7",
  //     totalFilledQty: "1.2",
  //     eventType: "forceOrder",
  //     tradeTime: 1714915021263,
  //     eventTime: 1714915021266,
  //   } as LiquidationType;
  //   console.log("e");
  //   handleLiquidationData(data, ctx);
  // }, 10_000);
});

// Обработчик текстовых сообщений
let tempCoinData: Partial<CoinType> = {};
tgBot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const currentState = userStates[userId];

  switch (currentState) {
    case "waiting_for_coin_name":
      const coinName = ctx.message.text;
      // Отправляем сообщение с просьбой ввести таймфрейм
      try {
        await binance.exchangeInfo({ symbol: coinName });
      } catch (error) {
        return ctx.reply("Такой монеты не существует");
      }
      tempCoinData.symbol = coinName;
      tempCoinData.addTime = new Date();
      ctx.reply("Введите таймфрейм в формате hh:mm:ss");
      // Устанавливаем состояние пользователя в 'waiting_for_time_frame'
      userStates[userId] = "waiting_for_time_frame";
      break;
    case "waiting_for_time_frame":
      const timeFrame = ctx.message.text;
      if (!timeRegex.test(timeFrame)) {
        return ctx.reply("Неверный формат времени");
      }
      tempCoinData.timeframe = timeFrame;
      // Отправляем сообщение с просьбой ввести сумму ликвидации
      ctx.reply("Введите сумму ликвидации для Лонгов");
      // Устанавливаем состояние пользователя в 'waiting_for_liquidation_amount'
      userStates[userId] = "waiting_for_liquidation_amount_buy";
      break;
    case "waiting_for_liquidation_amount_buy":
      const liquidationBuyAmount = ctx.message.text;
      if (Number.isNaN(liquidationBuyAmount)) {
        return ctx.reply("Неверный формат суммы ликвидации");
      }
      tempCoinData.liquidationBuy = Number(liquidationBuyAmount);
      ctx.reply("Введите сумму ликвидации для Шортов");
      userStates[userId] = "waiting_for_liquidation_amount_sell";
      break;
    case "waiting_for_liquidation_amount_sell":
      const liquidationSellAmount = ctx.message.text;
      if (Number.isNaN(liquidationSellAmount)) {
        return ctx.reply("Неверный формат суммы ликвидации");
      }
      tempCoinData.liquidationSell = Number(liquidationSellAmount);
      if (!tempCoinData.symbol) return;
      if (!tempCoinData.addTime) return;
      if (!tempCoinData.liquidationBuy) return;
      if (!tempCoinData.liquidationSell) return;
      if (!tempCoinData.timeframe) return;
      CoinsList.set(tempCoinData.symbol, tempCoinData as CoinType);
      tempCoinData = {};
      // Отправляем сообщение об успешном добавлении монеты
      ctx.reply("Монета успешно добавлена");
      // Удаляем состояние пользователя
      delete userStates[userId];
      break;
    default:
      break;
  }
  console.log(ctx.message.text);
});

tgBot.action("delete_coin", (ctx) => {
  const keyboardKeys = Array.from(CoinsList.keys()).map((coin) => [
    { text: coin, callback_data: `delete_${coin}` },
  ]);
  keyboardKeys.push([{ text: "Отмена", callback_data: "cancel_delete_coin" }]);
  const coinsKeyboard = {
    reply_markup: {
      inline_keyboard: keyboardKeys,
    },
  };

  console.log(coinsKeyboard);
  console.log(JSON.stringify(coinsKeyboard, null, 2));

  ctx.reply("Выберите монету, которую нужно удалить", coinsKeyboard);
});

tgBot.action(/^delete_(\w+)$/, (ctx) => {
  // CoinsList.delete(coin);
  const coinName = ctx.match[1];
  if (!CoinsList.has(coinName)) {
    return ctx.reply("Нет такой монеты в списке");
  }
  CoinsList.delete(coinName);
  ctx.reply(`Монета ${coinName} успешно удалена`);
});

tgBot.action("coins_list", (ctx) => {
  let text = "";
  CoinsList.forEach((coin) => {
    Logger.debug(coin);
    text += `Монета: ${coin.symbol}\nВремя добавления: ${coin.addTime}\nТаймфрейм: ${coin.timeframe}\nСумма ликвидации Long: ${coin.liquidationBuy}\nСумма ликвидации Short: ${coin.liquidationSell}\n\n`;
  });
  ctx.reply(text || "Пусто");
});

// Обработка нажатия кнопки отмены
tgBot.action("cancel_delete_coin", (ctx) => {
  userStates[ctx.from.id] = null;
  ctx.reply("Удаление монеты отменено");
});

tgBot.action("cancel", (ctx) => {
  userStates[ctx.from.id] = null;
  ctx.reply("Добавление монеты отменено");
});

// Функция для обработки данных о ликвидации
const handleLiquidationData = (data: LiquidationType, ctx: any) => {
  // Находим соответствующий элемент в массиве CoinsList
  if (!CoinsList.has(data.symbol)) return;
  const coin = CoinsList.get(data.symbol);
  if (!coin) return;
  const { addTime, timeframe } = coin;
  if (!addTime) return;
  if (!timeframe) return;
  // Проверяем, прошло ли достаточно времени с момента последнего вывода названия монеты
  const currentTime = new Date();
  const elapsedTime = currentTime.getTime() - addTime.getTime();
  const intervalInSeconds = getSecondsFromTimeString(timeframe);

  Logger.log({ coin });
  if (elapsedTime >= intervalInSeconds * 1000) {
    if ((coin.liquidations?.long ?? 0) > (coin?.liquidationBuy ?? 0)) {
      let text = `Превышен установденный лимит ликвидаций по монете ${coin.symbol}\n\n`;
      text += `Сторона превышения лимита: LONG\n`;
      text += `Ликвидайций LONG: $${
        coin.liquidations?.long ? coin.liquidations?.long.toFixed(4) : 0
      }\n`;
      text += `Ликвидаций SHORT: $${
        coin.liquidations?.short ? coin.liquidations?.short.toFixed(4) : 0
      }\n`;
      text += `Заданный лимит ликвидаций LONG: $${coin.liquidationBuy}\n`;
      text += `Заданный лимит ликвидаций SHORT: $${coin.liquidationSell}\n`;
      text += `Заданный таймфрейм: ${coin.timeframe}\n`;
      ctx.reply(text);
      console.log(text);
    }
    if ((coin.liquidations?.short ?? 0) > (coin?.liquidationSell ?? 0)) {
      let text = `Превышен установденный лимит ликвидаций по монете ${coin.symbol}\n\n`;
      text += `Сторона превышения лимита: SHORT\n`;
      text += `Ликвидайций LONG: $${
        coin.liquidations?.long ? coin.liquidations?.long.toFixed(4) : 0
      }\n`;
      text += `Ликвидаций SHORT: $${
        coin.liquidations?.short ? coin.liquidations?.short.toFixed(4) : 0
      }\n`;
      text += `Заданный лимит ликвидаций LONG: $${coin.liquidationBuy}\n`;
      text += `Заданный лимит ликвидаций SHORT: $${coin.liquidationSell}\n`;
      text += `Заданный таймфрейм: ${coin.timeframe}\n`;
      ctx.reply(text);
      console.log(text);
    }
    coin.addTime = currentTime;
    CoinsList.set(data.symbol, {
      ...coin,
      addTime: new Date(),
      liquidations: { long: 0, short: 0 },
    });
  }

  const liquidationQty = Number(data.totalFilledQty) * Number(data.price);
  if (data.side === "BUY") {
    CoinsList.set(data.symbol, {
      ...coin,
      liquidations: { ...coin.liquidations, short: coin.liquidations?.short ?? 0 + liquidationQty },
    });
  } else {
    CoinsList.set(data.symbol, {
      ...coin,
      liquidations: { ...coin.liquidations, long: coin.liquidations?.long ?? 0 + liquidationQty },
    });
  }
};

// Функция для получения количества секунд из строки времени в формате "hh:mm:ss"
const getSecondsFromTimeString = (timeString: string): number => {
  const [hours, minutes, seconds] = timeString.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
};

tgBot
  .launch()
  .then(() => {
    Logger.log("Bot started");
  })
  .catch((err) => {
    console.error("Ошибка при запуске бота:", err);
  });
