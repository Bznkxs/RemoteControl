import * as ConversationClasses from "./conversation.js";
import {TabElementWrapper, TabPageElementWrapper} from "../elements/tab_element.js";
import {ConversationWindow} from "./conversation_window.js";
import {TerminalTextLogMessage} from "../../shared/message.js";

export
class ConversationManager {
    constructor(id, communicationAPI) {
        this.conversations = [];
        this.channelsReference = [];
        this.id = id;
        this.communicationAPI = communicationAPI;
    }

    createChannel = (id=null) => {
        const channel = {

            id: id || this.id + "-" + this.channelsReference.length,
            destroyed: false,
            messageCallbacks: new Map(),
            sendInput: (inputString, options) => {
                if (channel.destroyed) {
                    return;
                }
                this.communicationAPI.sendInput(channel.id, inputString, options);
            },
            sendCommand: (commandString) => {
                if (channel.destroyed) {
                    return;
                }
                this.communicationAPI.sendCommand(channel.id, commandString);
            },
            sendSignal: (signal) => {
                if (channel.destroyed) {
                    return;
                }
                this.communicationAPI.sendSignal(channel.id, signal);
            },
            onMessage: (callback) => {
                if (channel.destroyed) {
                    return;
                }
                const onSerializedMessageCallback = (serializedMessage) => {
                    console.log(`[ConversationManager] Channel ${channel.id} Received message`, serializedMessage)
                    callback(TerminalTextLogMessage.deserialize(serializedMessage));
                }
                channel.messageCallbacks[callback] = onSerializedMessageCallback ;
                this.communicationAPI.onSerializedMessage(channel.id, onSerializedMessageCallback);
            },
            removeMessageListener: (callback) => {
                if (channel.destroyed) {
                    return;
                }
                this.communicationAPI.removeSerializedMessageListener(channel.id, channel.messageCallbacks[callback]);
                channel.messageCallbacks[callback] = null;

            },
            remove: () => {
                if (channel.destroyed) {
                    return;
                }
                this.communicationAPI.removeChannel(channel.id);
                channel.destroyed = true;
            },
            onScriptSpawned: (callback) => {
                if (channel.destroyed) {
                    return;
                }
                this.communicationAPI.onScriptSpawned(channel.id, callback);
            }
        }
        console.log("[ConversationManager] Creating channel", channel.id)
        this.communicationAPI.createChannel(channel.id);
        this.channelsReference.push(channel);  // ConversationManager does not own channels
        return channel;
    }

    getNewChannelID = () => {
        if (this._getNewChannelIDNumber === undefined) {
            this._getNewChannelIDNumber = 0;
        }
        return this.id + "-channel-" + this._getNewChannelIDNumber++;
    }

    createConversation = (className) => {
        const conversation = new ConversationClasses[className](() => {return this.createChannel(this.getNewChannelID());}, null, null);
        this.conversations.push(conversation);
        return conversation;
    }

    removeConversation = (conversation) => {
        this.conversations = this.conversations.filter((conv) => conv !== conversation);
        conversation.destroy();
    }
}

export class TerminalEmulatorTabWrapper extends TabElementWrapper {
    constructor(containerSimulatorTabPageWrapper, id, addTabButton=true, closeButton=true) {
        const containerElement = containerSimulatorTabPageWrapper.tabContentElement;
        console.log("[TerminalEmulatorTabWrapper] Creating tab wrapper", containerSimulatorTabPageWrapper, id)
        super(containerElement, id, addTabButton, closeButton);
        this.containerTabPageElementWrapper = containerSimulatorTabPageWrapper;
        this.defaultNewTabConfig = {
            tabClass: ConversationWindow,
            tabName: "Conversation",
            id: null,
            showTab: true,
            otherConfig: {
                eolGetter: null,
                command: "",
                stdin: "",
                eol: "\n"
            }
        };
    }
}

export class VisualizedConversationManager extends ConversationManager {
    constructor(id, communicationAPI, containerSimulatorTabPageWrapper) {
        super(id, communicationAPI);
        // this.conversationTabContainerElement = conversationTabContainerElement;
        this.tabElementWrapper = new TerminalEmulatorTabWrapper(containerSimulatorTabPageWrapper, id);
        let newTabID = 0;
        let newTabName = 0;

        this.tabElementWrapper.defaultNewTabConfig.id = () => "conversation-" + newTabID++;
        this.tabElementWrapper.defaultNewTabConfig.tabName = () => "Conversation " + newTabName++;
        this.tabElementWrapper.addTabButton.removeEventListener("click", this.tabElementWrapper.addTabButtonClickListener);
        this.tabElementWrapper.addTabButton.addEventListener("click", () => {
            this.createConversation();
        });
    }

    createConversation = ({command, stdin, eol}={}) => {
        const newConversationTab = this.tabElementWrapper.createTab({otherConfig: {command, stdin, eol}});
        const conversation = new ConversationClasses.VisualizedConversation(
            () => this.createChannel(this.getNewChannelID()),
            null,
            newConversationTab.id,
            newConversationTab);
        this.conversations.push(conversation);
        return conversation;
    }
}