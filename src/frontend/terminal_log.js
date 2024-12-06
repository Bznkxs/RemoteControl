// const { TextClass, TerminalTextLogMessage, TerminalCommandLogMessage } = require('./terminal_log_message.js');
// const { writeMessageToElement } = require('./write_message_to_element.js');

import { writeMessageToElement } from "./write_message_to_element.js";
import { TerminalTextLogMessage } from "./terminal_log_message.js";

/**
 * A class that holds log messages and hooks elements to display them.
 */
export
class Log {
    /**
     * @param {Array<TerminalTextLogMessage>} messages
     * @param {Array<HTMLElement>} hookedElements
     */
    constructor(messages, hookedElements) {
        const this_messages = [];  // protected
        const this_hookedElements = [];  // protected

        /**
         * Warning: This method does not display the message. Use log() instead.
         * @param message
         */
        this.addMessageOnlyWithoutDisplay = (message) => {
            this_messages.push(message);
        }

        /**
         * Warning: This method does not remove the messages from display. Use clear() instead.
         */
        this.removeAllMessagesOnlyWithoutDisplay = () => {
            this_messages.splice(0, this_messages.length);
        }

        /**
         * Warning: This method does not remove the message from display.
         * User can only clear all messages. Use clear() instead.
         */
        this.removeMessageOnlyWithoutDisplay = (message) => {
            const index = this_messages.map((message) => message.text).indexOf(message.text);
            if (index !== -1) {
                this_messages.splice(index, 1);
                return true;
            }
            return false;
        }

        this.getMessageLength = () => {
            return this_messages.length;
        }

        this.getMessagesSlice = () => {
            return this_messages.slice();
        }

        this.hookElement = (element) => {
            if (!this_hookedElements.includes(element)) {
                this_hookedElements.push(element);
            }
        }

        this.removeHookedElement = (element) => {
            const index = this_hookedElements.indexOf(element);
            if (index !== -1) {
                this_hookedElements.splice(index, 1);
                return true;
            }
            return false;
        }

        this.getHookedElementsSlice = () => {
            return this_hookedElements.slice();
        }

        if (!messages) {
        } else {
            messages.forEach((message) => {
                this.log(message);
            });
        }
        if (!hookedElements) {
        } else {
            hookedElements.forEach((element) => {
                this.hookElement(element);
            });
        }
    }

    get size() {
        return this.getMessageLength();
    }

    get hookedElementsSlice() {
        // return a protected copy of the listeners
        return this.getHookedElementsSlice();
    }

    get messagesSlice() {
        // return a protected copy of the messages
        return this.getMessagesSlice();
    }

    log(message) {
        this.addMessageOnlyWithoutDisplay(message);
        this.hookedElementsSlice.forEach((element) => {
            writeMessageToElement(element, message);
        });
    }

    // remove(message) {
    //
    // }

    clear() {
        this.removeAllMessagesOnlyWithoutDisplay();
        this.hookedElementsSlice.forEach((element) => {
            element.innerHTML = "";
        });
    }

    /**
     * A class that logs messages from multiple logs into one log.
     * Usage: const monitoringLog = new Log.MonitoringLog([log1, log2, log3], [element1, element2, element3]);
     * The monitoring log will automatically log messages from log1, log2, and log3
     * into element1, element2, and element3 when log1, log2, and log3 log a message.
     * @type {*}
     */
    static MonitoringLog = class MonitoringLog extends Log {
        constructor(monitoredLogs, hookedElements) {
            /**
             * @param {Array<TerminalTextLogMessage>} arrays
             * @returns {Array<TerminalTextLogMessage>}
             */
            function mergeOrderedArrays(arrays) {
                return arrays
                    .flat() // Combine all arrays into one
                    .sort((a, b) => a.time - b.time); // Sort numerically
            }
            const initialLogs = mergeOrderedArrays(monitoredLogs.map((log) => log.messagesSlice));
            super(initialLogs, hookedElements);
            // this.getMonitoredLogs = () => { return monitoredLogs.slice(); }
            monitoredLogs.forEach((log) => {
                const originalLog = log.log;
                log.log = (message) => {
                    originalLog.call(log, message);
                    this.log(message);
                }
            });
        }
    }
}


// module.exports = { Log };