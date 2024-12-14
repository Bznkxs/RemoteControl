import * as ConversationClasses from "./conversation.js";
import {TabElementWrapper} from "./tab_element";
import {ConversationWindow} from "./conversation_window";

export
class ConversationManager {
    constructor(id, communicationAPI) {
        this.conversations = [];
        this.channelsReference = [];
        this.id = id;
        this.communicationAPI = communicationAPI;
    }

    createChannel() {
        const channel = {
            id: this.id + "-" + this.channelsReference.length,
            destroyed: false,
            messageCallbacks: [],
            sendInput: (inputString) => {
                if (channel.destroyed) {
                    return;
                }
                this.communicationAPI.sendInput(channel.id, inputString);
            },
            sendCommand: (commandString) => {
                if (channel.destroyed) {
                    return;
                }
                this.communicationAPI.sendCommand(channel.id, commandString);
            },
            onMessage: (callback) => {
                if (channel.destroyed) {
                    return;
                }
                channel.messageCallbacks.push(callback);
                this.communicationAPI.onMessage(channel.id, callback);
            },
            remove: () => {
                if (channel.destroyed) {
                    return;
                }
                this.communicationAPI.removeChannel(channel.id);
                channel.destroyed = true;
            },
        }
        this.communicationAPI.createChannel(channel.id);
        this.channelsReference.push(channel);  // ConversationManager does not own channels
        return channel;
    }

    createConversation(className) {
        const conversation = new ConversationClasses[className](this.createChannel, null, this.id);
        this.conversations.push(conversation);
        return conversation;
    }

    removeConversation(conversation) {
        this.conversations = this.conversations.filter((conv) => conv !== conversation);
        conversation.destroy();
    }
}

export class VisualizedConversationManager extends ConversationManager {
    constructor(id, communicationAPI, conversationTabContainerElement) {
        super(id, communicationAPI);
        this.conversationTabContainerElement = conversationTabContainerElement;
        this.tabElementWrapper = new TabElementWrapper(conversationTabContainerElement, id);

    }

    createConversation(initialValues={command: "", stdin: ""}) {
        const newConversationTab = new ConversationWindow("Conversation Name",
            "conversation-" + this.conversations.length, this.tabElementWrapper, initialValues);
        const conversation = new ConversationClasses.VisualizedConversation(
            this.createChannel, null, this.id, newConversationTab);
        this.conversations.push(conversation);
        return conversation;
    }


}