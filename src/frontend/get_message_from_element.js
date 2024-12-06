// const {TerminalTextLogMessage, TextClass, TerminalCommandLogMessage} = require("./terminal_log_message");

import {TerminalTextLogMessage, TextClass, TerminalCommandLogMessage} from "./terminal_log_message.js";


/**
 *
 * @param {HTMLInputElement} inputElement
 * @returns {TerminalTextLogMessage}
 */

export
const getMessageFromInputElement = (inputElement) => {
    const inputValue = inputElement.value;
    return TerminalTextLogMessage.createMessageWithCurrentTime(inputValue, TextClass.INPUT);
};

/**
 *
 * @param {HTMLInputElement} inputElement
 * @returns {TerminalCommandLogMessage}
 */

export
const getCommandFromInputElement = (inputElement) => {
    const inputValue = inputElement.value;
    return TerminalCommandLogMessage.createTimedCommandMessage(inputValue, true);
}


// module.exports = {
//     getMessageFromInputElement,
//     getCommandFromInputElement
// };