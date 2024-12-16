import * as ConversationClasses from "./conversation.js";
import {TabElementWrapper} from "../tab_element.js";
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

    createChannel = () => {
        const channel = {

            id: this.id + "-" + this.channelsReference.length,
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

    createConversation = (className) => {
        const conversation = new ConversationClasses[className](this.createChannel, null, this.id);
        this.conversations.push(conversation);
        return conversation;
    }

    removeConversation = (conversation) => {
        this.conversations = this.conversations.filter((conv) => conv !== conversation);
        conversation.destroy();
    }
}

export class VisualizedConversationManager extends ConversationManager {
    constructor(id, communicationAPI, conversationTabContainerElement) {
        super(id, communicationAPI);
        // this.conversationTabContainerElement = conversationTabContainerElement;
        this.tabElementWrapper = new TabElementWrapper(conversationTabContainerElement, id);

    }

    createConversation = (initialValues={command: "", stdin: ""}) => {
        const newConversationTab = new ConversationWindow("Conversation Name",
            "conversation-" + this.conversations.length, this.tabElementWrapper, null, initialValues);
        const conversation = new ConversationClasses.VisualizedConversation(
            this.createChannel, null, this.id, newConversationTab);
        this.conversations.push(conversation);
        return conversation;
    }
}