"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const chalk_1 = __importDefault(require("chalk"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const NODE_ENV = process.env.NEXT_PUBLIC_NODE_ENV;
const TRACE_ERRORS = process.env.NEXT_PUBLIC_TRACE_ERRORS;
/**
 * Класс Logger выводит сообщения в консоль в зависимости от настроек окружения.
 *
 * Использовать вместо обычного console.log, console.error, console.warn. Данный
 * класс должен испольщоваться только во время разработки. После сборки проекта
 * отключить вывод сообщений в консоль в .env файле поставив переменную окружения
 * `NEXT_PUBLIC_ENV = production`. Изначально переменная окружения `NEXT_PUBLIC_ENV`
 * стоит в значении `development`.
 *
 * Если в логере нужно отслеживать где была вызвана ошибка, то в переменной окружения
 * в .env файле нужно поставить переменную окружения `NEXT_PUBLIC_TRACE_ERRORS = true`.
 * Таким образом в консоли будет отображаться стек вызовов функций.
 */
class Logger {
    static getTime() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, "0");
        const minutes = now.getMinutes().toString().padStart(2, "0");
        const seconds = now.getSeconds().toString().padStart(2, "0");
        return `${hours}:${minutes}:${seconds}`;
    }
    static get consoleAlwd() {
        // eslint-disable-next-line no-console
        return console;
    }
    static get isDebug() {
        if (NODE_ENV === undefined) {
            const logMsg = 'Logger can not find NODE_ENV variable. Look at .env file and be shure that you have NEXT_PUBLIC_NODE_ENV in .env file with proper value "development" or "production"';
            this.consoleAlwd.error(logMsg);
            return false;
        }
        return NODE_ENV === "development";
    }
    static get isTracingErrors() {
        if (TRACE_ERRORS === undefined) {
            this.consoleAlwd.warn("TRACE_ERRORS is not defined");
            return false;
        }
        if (TRACE_ERRORS !== "true" && TRACE_ERRORS === "false") {
            this.consoleAlwd.warn('TRACE_ERRORS could be only "true" or "false"');
            return false;
        }
        return TRACE_ERRORS === "true";
    }
    static error(message, ...optionalParams) {
        if (!this.isDebug)
            return;
        if (this.isTracingErrors) {
            return this.consoleAlwd.trace(chalk_1.default.redBright(`[ERROR] - ${chalk_1.default.gray(`[${this.getTime()}]`)} -`), message, ...optionalParams);
        }
        return this.consoleAlwd.log(chalk_1.default.redBright(`[ERROR] - ${chalk_1.default.gray(`[${this.getTime()}]`)} -`), message, ...optionalParams);
    }
    static log(message, ...optionalParams) {
        if (!this.isDebug)
            return;
        return this.consoleAlwd.log(chalk_1.default.greenBright(`[LOG]   - ${chalk_1.default.gray(`[${this.getTime()}]`)} -`), message, ...optionalParams);
    }
    static warn(message, ...optionalParams) {
        if (!this.isDebug)
            return;
        return this.consoleAlwd.log(chalk_1.default.yellowBright(`[WARNN] - ${chalk_1.default.gray(`[${this.getTime()}]`)} -`), message, ...optionalParams);
    }
    static debug(message, ...optionalParams) {
        if (!this.isDebug)
            return;
        return this.consoleAlwd.log(chalk_1.default.magentaBright(`[DEBUG] - ${chalk_1.default.gray(`[${this.getTime()}]`)} -`), message, ...optionalParams);
    }
}
exports.Logger = Logger;
