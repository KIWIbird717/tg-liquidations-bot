"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const telegraf_1 = require("telegraf");
const Logger_1 = require("./utils/Logger");
const binance_api_node_1 = __importDefault(require("binance-api-node"));
const node_binance_api_1 = __importDefault(require("node-binance-api"));
dotenv_1.default.config();
/** ============= Tg bot bootstrap ============= */
const tgBot = new telegraf_1.Telegraf(process.env.API_KEY_BOT);
const binance = (0, binance_api_node_1.default)();
const binanceNode = new node_binance_api_1.default();
const CoinsList = new Map();
const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
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
const userStates = {};
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
    binanceNode.futuresLiquidationStream((data) => {
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
let tempCoinData = {};
tgBot.on("text", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = ctx.from.id;
    const currentState = userStates[userId];
    switch (currentState) {
        case "waiting_for_coin_name":
            const coinName = ctx.message.text;
            // Отправляем сообщение с просьбой ввести таймфрейм
            try {
                yield binance.exchangeInfo({ symbol: coinName });
            }
            catch (error) {
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
            if (!tempCoinData.symbol)
                return;
            if (!tempCoinData.addTime)
                return;
            if (!tempCoinData.liquidationBuy)
                return;
            if (!tempCoinData.liquidationSell)
                return;
            if (!tempCoinData.timeframe)
                return;
            CoinsList.set(tempCoinData.symbol, tempCoinData);
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
}));
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
        Logger_1.Logger.debug(coin);
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
const handleLiquidationData = (data, ctx) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    // Находим соответствующий элемент в массиве CoinsList
    if (!CoinsList.has(data.symbol))
        return;
    const coin = CoinsList.get(data.symbol);
    if (!coin)
        return;
    const { addTime, timeframe } = coin;
    if (!addTime)
        return;
    if (!timeframe)
        return;
    // Проверяем, прошло ли достаточно времени с момента последнего вывода названия монеты
    const currentTime = new Date();
    const elapsedTime = currentTime.getTime() - addTime.getTime();
    const intervalInSeconds = getSecondsFromTimeString(timeframe);
    Logger_1.Logger.log({ coin });
    if (elapsedTime >= intervalInSeconds * 1000) {
        if (((_b = (_a = coin.liquidations) === null || _a === void 0 ? void 0 : _a.long) !== null && _b !== void 0 ? _b : 0) > ((_c = coin === null || coin === void 0 ? void 0 : coin.liquidationBuy) !== null && _c !== void 0 ? _c : 0)) {
            let text = `Превышен установденный лимит ликвидаций по монете ${coin.symbol}\n\n`;
            text += `Сторона превышения лимита: LONG\n`;
            text += `Ликвидайций LONG: $${((_d = coin.liquidations) === null || _d === void 0 ? void 0 : _d.long) ? (_e = coin.liquidations) === null || _e === void 0 ? void 0 : _e.long.toFixed(4) : 0}\n`;
            text += `Ликвидаций SHORT: $${((_f = coin.liquidations) === null || _f === void 0 ? void 0 : _f.short) ? (_g = coin.liquidations) === null || _g === void 0 ? void 0 : _g.short.toFixed(4) : 0}\n`;
            text += `Заданный лимит ликвидаций LONG: $${coin.liquidationBuy}\n`;
            text += `Заданный лимит ликвидаций SHORT: $${coin.liquidationSell}\n`;
            text += `Заданный таймфрейм: ${coin.timeframe}\n`;
            ctx.reply(text);
            console.log(text);
        }
        if (((_j = (_h = coin.liquidations) === null || _h === void 0 ? void 0 : _h.short) !== null && _j !== void 0 ? _j : 0) > ((_k = coin === null || coin === void 0 ? void 0 : coin.liquidationSell) !== null && _k !== void 0 ? _k : 0)) {
            let text = `Превышен установденный лимит ликвидаций по монете ${coin.symbol}\n\n`;
            text += `Сторона превышения лимита: SHORT\n`;
            text += `Ликвидайций LONG: $${((_l = coin.liquidations) === null || _l === void 0 ? void 0 : _l.long) ? (_m = coin.liquidations) === null || _m === void 0 ? void 0 : _m.long.toFixed(4) : 0}\n`;
            text += `Ликвидаций SHORT: $${((_o = coin.liquidations) === null || _o === void 0 ? void 0 : _o.short) ? (_p = coin.liquidations) === null || _p === void 0 ? void 0 : _p.short.toFixed(4) : 0}\n`;
            text += `Заданный лимит ликвидаций LONG: $${coin.liquidationBuy}\n`;
            text += `Заданный лимит ликвидаций SHORT: $${coin.liquidationSell}\n`;
            text += `Заданный таймфрейм: ${coin.timeframe}\n`;
            ctx.reply(text);
            console.log(text);
        }
        coin.addTime = currentTime;
        CoinsList.set(data.symbol, Object.assign(Object.assign({}, coin), { addTime: new Date(), liquidations: { long: 0, short: 0 } }));
    }
    const liquidationQty = Number(data.totalFilledQty) * Number(data.price);
    if (data.side === "BUY") {
        CoinsList.set(data.symbol, Object.assign(Object.assign({}, coin), { liquidations: Object.assign(Object.assign({}, coin.liquidations), { short: (_r = (_q = coin.liquidations) === null || _q === void 0 ? void 0 : _q.short) !== null && _r !== void 0 ? _r : 0 + liquidationQty }) }));
    }
    else {
        CoinsList.set(data.symbol, Object.assign(Object.assign({}, coin), { liquidations: Object.assign(Object.assign({}, coin.liquidations), { long: (_t = (_s = coin.liquidations) === null || _s === void 0 ? void 0 : _s.long) !== null && _t !== void 0 ? _t : 0 + liquidationQty }) }));
    }
    console.log("CoinsList:", JSON.stringify(CoinsList, null, 2));
};
// Функция для получения количества секунд из строки времени в формате "hh:mm:ss"
const getSecondsFromTimeString = (timeString) => {
    const [hours, minutes, seconds] = timeString.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
};
tgBot
    .launch()
    .then(() => {
    Logger_1.Logger.log("Bot started");
})
    .catch((err) => {
    console.error("Ошибка при запуске бота:", err);
});
