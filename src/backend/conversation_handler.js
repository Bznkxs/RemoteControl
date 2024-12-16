const {ipcMain} = require ('electron');
const {CommandProcessor} = require("./command_processor");
const {TerminalInterface} = require("./terminal_interface");


const requireESM = require('esm')(module);
const {Log} = requireESM("../shared/message_log");
const {TextClass} = requireESM("../shared/text_class");
const {TerminalCommandLogMessage, TerminalTextLogMessage} = requireESM("../shared/message");
class Channel {
    constructor(window, channelName) {
        this.window = window;
        this.channelName = channelName;
        this.callbacks = [];
        ipcMain.on('remove-channel', (event, channelName) => {
            if (channelName === this.channelName) {
                this.destroy();
            }
        });
    }

    destroy() {
        this.callbacks.forEach(([channelName, listener]) => {
            ipcMain.removeListener(channelName, listener);
        });
    }

    onEvent(channelName, callback) {
        const listener = (event, ...args) => {
            callback(...args);
        }
        ipcMain.on(channelName, listener);
        this.callbacks.push([channelName, listener]);
    }

    /**
     *
     * @param {function(string)} callback
     */
    onSendInput(callback) {
        this.onEvent('channel-send-input-' + this.channelName, callback);
    }

    onSendCommand(callback) {
        this.onEvent('channel-send-command-' + this.channelName, callback);
    }

    onSendSignal(callback) {
        this.onEvent('channel-signal-' + this.channelName, callback);
    }

    sendScriptSpawned(info) {
        this.window.webContents.send('channel-script-spawn-' + this.channelName, info);
    }

    /**
     *
     * @param {TerminalTextLogMessage} message
     */
    sendMessage(message) {
        this.window.webContents.send('channel-serialized-message-' + this.channelName, message.serialize());
    }
}

class ConversationHandler {
    constructor(window) {
        this.window = window;
        this.conversations = [];
        ipcMain.on('create-channel', (event, channelId) => {
            this.addConversation(channelId);
        });
    }

    addConversation(channelName) {
        console.log("[ConversationHandler] Received channel creation", channelName)
        const conversation = {
            channel: new Channel(this.window, channelName),
            commandProcessor: new CommandProcessor(),
            terminalInterface: new TerminalInterface(),
            messageLog: new Log()
        };

        conversation.channel.onSendInput((text, options={password: false}) => {
            conversation.commandProcessor.sendToChild(text);
            const message = TerminalTextLogMessage.createMessageWithCurrentTime(text, TextClass.INPUT, true, options.password);
            conversation.messageLog.log(message);
            conversation.channel.sendMessage(message);
        })

        conversation.channel.onSendCommand((text) => {
            const message = TerminalCommandLogMessage.createTimedCommandMessage(text);
            conversation.commandProcessor.createChildProcess(message.command, message.args);
            conversation.messageLog.log(message);
            conversation.channel.sendMessage(message);
        })

        conversation.channel.onSendSignal((signal) => {
            conversation.commandProcessor.killChildProcess(signal);
            const message = TerminalTextLogMessage.createMessageWithCurrentTime(signal, TextClass.SIGNAL);
            conversation.messageLog.log(message);
            conversation.channel.sendMessage(message);
        })

        const processOutputData = (rawOutput) => {
            const {stream: ansiOutputStream} = conversation.terminalInterface.parseRawOutput(rawOutput);
            const message = TerminalTextLogMessage.createMessageWithCurrentTime(rawOutput, TextClass.CONTENT);
            message.ansiOutputStream = ansiOutputStream;
            conversation.messageLog.log(message);
            conversation.channel.sendMessage(message);
        }

        conversation.commandProcessor.connectSignals({
            onSpawnedCallback: () => conversation.channel.sendScriptSpawned(new Date()),
            onStdoutCallback: processOutputData,
            onStderrCallback: processOutputData,
            onExitCallback: (exitCode) => {
                const message = TerminalTextLogMessage.createMessageWithCurrentTime(exitCode, TextClass.EXITCODE);
                conversation.messageLog.log(message);
                conversation.channel.sendMessage(message);
            },
            onStdinCallback: null
        });



        this.conversations.push(conversation);
    }


}

module.exports = {ConversationHandler};