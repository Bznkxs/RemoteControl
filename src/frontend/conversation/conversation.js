import {TerminalTextLogMessage} from "../../shared/message.js";
import {ConversationWindow} from "./conversation_window.js";


export
class BaseConversation {
    constructor(channelCreator, channelCreatorArgs, id) {
        this.channel = channelCreator(channelCreatorArgs);
        this.id = id;
        this.messageListeners = [];
        this.onMessage(this.defaultMessageListener);
        this.messageList = [];
        this._EOL = "\n";
        this.exitCodeListeners = [];
    }

    sendInput = (inputString) => {
        this.channel.sendInput(inputString);
    }

    getEOL = () => {
        return this._EOL;
    }

    /**
     *
     * @param {string} eol
     * @param strictCheck
     * @returns {boolean} If the EOL was set successfully
     */
    setEOL = (eol, strictCheck=false) => {
        if (strictCheck) {
            if (['\n', '\r\n', '\r', '\n\r', ''].indexOf(eol) === -1) {
                return false;
            }
        }
        this._EOL = eol;
        return true;
    }

    sendInputWithEOL = (inputString) => {
        this.sendInput(inputString + this.getEOL());
    }

    sendCommand = (commandString, options) => {
        this.channel.sendCommand(commandString, options);
    }

    sendSignal = (signal) => {
        this.channel.sendSignal(signal);
    }

    /**
     * @param {TerminalTextLogMessage} message
     */
    defaultMessageListener = (message) => {
        this.insertMessage(message);
        if (message.textClass.isInput()) {
            this.inputListener(message);
        }
        else if (message.textClass.isCommand()) {
            this.commandListener(message);
        }
        else if (message.textClass.isSignal()) {
            this.signalListener(message);
        }
        else if (message.textClass.isContent()) {
            this.contentListener(message);
        }
        else if (message.textClass.isExitCode()) {
            this.exitCodeListener(message);
        }
    }

    inputListener = () => {}
    commandListener = () => {}
    signalListener = () => {}
    contentListener = () => {}
    exitCodeListener = (message) => { this.exitCodeListeners.forEach((listener) => listener(message)); }

    onExitCode = (callback) => {
        this.exitCodeListeners.push(callback);
    }

    removeExitCodeListener = (callback) => {
        this.exitCodeListeners = this.exitCodeListeners.filter((listener) => listener !== callback);
    }

    onMessage = (callback) => {
        this.messageListeners.push(callback);
        this.channel.onMessage(callback);
    }

    onScriptSpawned = (callback) => {
        this.channel.onScriptSpawned(callback);
    }

    removeMessageListener = (callback) => {
        this.messageListeners = this.messageListeners.filter((listener) => listener !== callback);
        this.channel.removeMessageListener(callback);
    }

    insertMessage = (message) => {
        for (let messageIdx = this.messageList.length - 1; messageIdx >= 0; messageIdx--) {
            const messageInList = this.messageList[messageIdx];
            if (messageInList.time <= message.time) {
                this.messageList.splice(messageIdx, 0, message);
                break;
            }
        }
    }

    removeMessage = (message) => {
        if (message instanceof TerminalTextLogMessage) {
            this.messageList = this.messageList.filter((messageInList) => messageInList !== message);
        } else if (typeof message === "number") {
            this.messageList.splice(message, 1);
        }
    }

    clearMessages = () => {
        this.messageList = [];
    }



    destroy() {
        this.channel.remove();
    }
}


export
class VisualizedConversation extends BaseConversation {
    constructor(channelCreator, channelCreatorArgs, id, conversationWindow) {
        // conversationWindow is a TabPageElementWrapper.
        // The conversationWindow object belongs to this object.
        super(channelCreator, channelCreatorArgs, id);
        this.conversationWindow = conversationWindow;
        this.conversationWindow.setEOLGetter(this.getEOL);
        this.onMessage(this.conversationWindow.addMessage);
        this.conversationWindow.onChangeEOL((eol) => this.setEOLWithoutSync(eol, true));
        this.conversationWindow.onSendInputWithEOL(this.sendInputWithEOL);
        this.conversationWindow.onSendCommand(this.sendCommand);
        this.conversationWindow.onSendSignal(this.sendSignal);
        this.onScriptSpawned(this.conversationWindow.scriptSpawnedListener);

    }

    exitCodeListener = (message) => {
        this.conversationWindow.exitCodeListener(message);
        super.exitCodeListener(message);
    }


    /**
     * Set EOL without syncing to the conversation window
     * @param eol
     * @param strictCheck
     * @returns {boolean}
     */
    setEOLWithoutSync(eol, strictCheck=false) {
        return super.setEOL(eol, strictCheck);
    }

    /**
     * Set EOL and sync to the conversation window
     * @param eol
     * @param strictCheck
     */
    setEOL(eol, strictCheck=false) {
        console.log("Set EOL", eol, strictCheck)
        if (this.setEOLWithoutSync(eol, strictCheck)) {
            this.conversationWindow.syncEOL(eol);
            return true;
        }
        return false;
    }

    destroy() {
        this.conversationWindow.destroy();
        super.destroy();
    }
}