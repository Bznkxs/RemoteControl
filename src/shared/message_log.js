export class Log {
    /**
     * @param {Array<TerminalTextLogMessage>?} messages
     */
    constructor(messages) {
        this.messages = messages ? messages : [];
    }

    getMessagesSlice() {
        return this.messages.slice();
    }

    addMessageOnlyWithoutDisplay(message) {
        this.messages.push(message);
    }

    removeAllMessagesOnlyWithoutDisplay() {
        this.messages = [];
    }

    log(message) {
        this.addMessageOnlyWithoutDisplay(message);
    }

    clear() {
        this.removeAllMessagesOnlyWithoutDisplay();
    }
}

// module.exports = {Log};