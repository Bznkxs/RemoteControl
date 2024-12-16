import {TerminalCommandLogMessage, TerminalTextLogMessage} from "../../shared/message.js";
import {TextClass} from "../../shared/text_class.js";
import {visualizeAnsiOutputStream} from "./visualize_ansi_output_stream.js";

export class ConversationWindowLogMessage {
    constructor(message) {
        console.log("Creating BeautifiedLogMessage", message)
        this.parseANSI = true;
        if (!message instanceof TerminalTextLogMessage) {
            throw new Error('Message must be an instance of TerminalTextLogMessage');
        }

        // if message is a command, convert it to a TerminalCommandLogMessage
        if (message.isLogSubclass(TerminalCommandLogMessage)) {
            message = message.to(TerminalCommandLogMessage);
        }

        this.getMessage = () => message;
        let beautifiedMessage = null;
        this.getBeautifiedMessage = () => {
            if (!beautifiedMessage) {
                beautifiedMessage = this.getMessageElement();
            }
            return beautifiedMessage;
        }
    }

    get beautifiedMessage() {
        return this.getBeautifiedMessage();
    }

    getTimeStampElement() {
        if (!this.timeStampElement) {
            const createTimeStampElement = () => {
                const time = this.getMessage().time;
                const timeStamp = document.createElement('span');
                timeStamp.classList.add('timestamp');
                timeStamp.innerText = `[${time.toLocaleTimeString('en-US',
                    {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3})
                }]`;
                return timeStamp;
            }
            this.timeStampElement = createTimeStampElement();
        }
        return this.timeStampElement;
    }

    static createContentElement(text, style) {
        const content = document.createElement('span');
        if (text instanceof Node) {
            content.classList.add(style);
            content.appendChild(text);
            return content;
        }

        if (!style) style = this.inferArgStyleFromText(text);
        content.classList.add(style);
        content.innerText = text;
        return content;
    }

    static inferArgStyleFromText(text) {
        console.log("[ConversationWindowLogMessage] Infer arg style from text", text)
        if (typeof text !== 'string') {
            return 'default';
        }
        if (text.startsWith('$')) {
            return 'variable';
        } else if (!isNaN(text)) {
            return 'number';
        } else if (text.startsWith('-')) {
            return 'args';
        } else {
            return 'default';
        }
    }

    /**
     * Creates a MessageContentContainer. This container contains the actual message (stored in ContentElements).
     */
    getMessageContentElement() {
        if (!this.messageContentElement) {
            const message = this.getMessage();
            const messageContentElement = document.createElement('div');
            messageContentElement.classList.add('messageContentContainer');
            const contentElementClassForMessage = 'content-breakable-span';
            const contentElementClassForCommand = 'content-breakable-span';
            if (message instanceof TerminalCommandLogMessage) {
                messageContentElement.classList.add(contentElementClassForMessage);
                const commandElement = this.constructor.createContentElement(message.command, 'command');
                messageContentElement.appendChild(commandElement);
                message.args.forEach((arg) => {
                    const argElement = this.constructor.createContentElement(arg);
                    messageContentElement.appendChild(argElement);
                });
            } else if (message.textClass.v === TextClass.EXITCODE.v) {
                messageContentElement.classList.add(contentElementClassForCommand);
                const contentElement = this.constructor.createContentElement("Process finished with exit code", 'exitCode');
                messageContentElement.appendChild(contentElement);
                const exitCodeElement = this.constructor.createContentElement(String(message.text.exitCode));
                messageContentElement.appendChild(exitCodeElement);
            } else {
                messageContentElement.classList.add(contentElementClassForMessage);
                const textToParse = this.getParsedMessage();
                const contentElement = this.constructor.createContentElement(textToParse, 'default');
                messageContentElement.appendChild(contentElement);
            }
            if (message.isInput) {
                messageContentElement.classList.add('input');
            }
            console.log("Message content element", messageContentElement)
            this.messageContentElement = messageContentElement;
        }
        return this.messageContentElement;
    }

    getFirstOutputOperationIndex() {
        if (!this.firstOutputOperationIndex) {
            this.firstOutputOperationIndex = 0;
        }
        return this.firstOutputOperationIndex;
    }

    getOutputOperationCount() {
        if (!this.outputOperationCount) {
            this.outputOperationCount = 0;
        }
        return this.outputOperationCount;
    }

    getLastOutputOperationIndex() {
        return this.getFirstOutputOperationIndex() + this.getOutputOperationCount() - 1;
    }

    setFirstOutputOperationIndex(index) {
        this.firstOutputOperationIndex = index;
    }

    setOutputOperationCount(count) {
        this.outputOperationCount = count;
    }

    setLastOutputOperationIndex(index) {
        this.outputOperationCount = index - this.getFirstOutputOperationIndex() + 1;
    }

    getParsedMessage() {
        if (!this.parsedMessage) {
            const message = this.getMessage();
            let htmlSnippet = message.text;
            if (message.textClass.v === TextClass.CONTENT.v && this.parseANSI) {
                console.log("[ConversationWindowLogMessage] Parsing ANSI for message", message.text)
                if (message.ansiOutputStream !== null && message.ansiOutputStream !== undefined) {
                    const {frag, otherReturnMessages} = visualizeAnsiOutputStream(message.ansiOutputStream);
                    console.log("[ConversationWindowLogMessage] Parsed ANSI", frag, otherReturnMessages)
                    if (frag === null) {
                        this.generateMessage = false;
                    } else {
                        htmlSnippet = frag;
                    }
                    this.otherReturnMessages = otherReturnMessages;
                }
                else this.generateMessage = false;
            }
            this.parsedMessage = htmlSnippet;
        }

        return this.parsedMessage;
    }

    getLogLevelElement = () => {
        if (!this.logLevelElement) {
            const logLevelElement = document.createElement('div');
            logLevelElement.classList.add('logLevel');
            logLevelElement.innerText = this.getMessage().textClass.v;
            this.logLevelElement = logLevelElement;
        }
        return this.logLevelElement;
    }

    static createVisibilityButton = () => {
        const visibilityButton = document.createElement('div');
        visibilityButton.classList.add('contentVisibilityButton');
        // closed eye emoji
        visibilityButton.innerText = 'hide';
        visibilityButton.addEventListener('click', () => {
            const messageContentContainer = visibilityButton.parentElement.parentElement.getElementsByClassName('messageContentContainer')[0];
            console.log("Message content container", messageContentContainer, visibilityButton.parentElement, visibilityButton.parentElement.parentElement)
            const messageContentHTML = messageContentContainer.innerHTML;
            messageContentContainer.classList.toggle('secret');

            if (messageContentContainer.classList.contains('secret')) {
                visibilityButton.innerText = 'show';
                messageContentContainer.innerHTML = "<span class='default' style='font-weight: normal'>🔑🔑🔑</span>"
                messageContentContainer.recover = () => {
                    messageContentContainer.innerHTML = messageContentHTML;
                }
            } else {
                visibilityButton.innerText = 'hide';
                messageContentContainer.recover();
                messageContentContainer.recover = undefined;
            }
        });
        return visibilityButton;
    }

    getVisibilityButton = () => {
        if (!this.visibilityButton) {
            this.visibilityButton = this.constructor.createVisibilityButton();
        }
        return this.visibilityButton;
    }

    getMetaElement = () => {
        if (!this.metaElement) {
            const metaElement = document.createElement('div');
            metaElement.classList.add('metaInfoContainer');
            const timeStampElement = this.getTimeStampElement();
            metaElement.appendChild(timeStampElement);
            const logLevelElement = this.getLogLevelElement();
            metaElement.appendChild(logLevelElement);
            const toggleVisibilityButton = this.getVisibilityButton();
            metaElement.appendChild(toggleVisibilityButton);
            this.metaElement = metaElement;
        }
        return this.metaElement;

    }

    /**
     * Creates a message element with a timestamp and message content.
     * @returns {HTMLDivElement}
     */
    getMessageElement() {
        if (!this.messageElement && this.generateMessage !== false) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('messageContainer');
            const metaElement = this.getMetaElement();
            messageElement.appendChild(metaElement);
            const messageContentContainer = this.getMessageContentElement();
            messageElement.appendChild(messageContentContainer);

            const comment = document.createComment("message.text");
            messageElement.appendChild(comment);

            const rawMessage = String(this.getMessage().text);
            rawMessage.split('\n').forEach((line) => {
                const comment = document.createComment(line);
                messageElement.appendChild(comment);
            })

            if (this.checkIfMergeWithPrevious()) {
                // hide meta info
                messageElement.classList.add('mergedWithPrevious');
            }

            this.messageElement = messageElement;
            if (this.generateMessage === false) {
                this.messageElement = null;
            }
        }
        return this.messageElement;
    }

    getMergedBlockTopBeautifiedMessage() {
        if (!this.mergedBlockTopBeautifiedMessage) {
            let previous = this.previousMessage;
            if (!previous || !this.checkIfMergeWithPrevious()) {
                this.mergedBlockTopBeautifiedMessage = {
                    message: this,
                    difference: 0
                };
            }
            else {
                this.mergedBlockTopBeautifiedMessage = previous.getMergedBlockTopBeautifiedMessage();
                this.mergedBlockTopBeautifiedMessage.difference += 1;
            }
            console.log("[ConversationWindowLogMessage] GetMergedBlockTopBeautifiedMessage", this.getMessage().text, this.mergedBlockTopBeautifiedMessage.message.getMessage().text, this.mergedBlockTopBeautifiedMessage.difference);
        }
        return this.mergedBlockTopBeautifiedMessage;
    }

    checkIfMergeWithPrevious() {
        if (this.mergeWithPrevious !== null && this.mergeWithPrevious !== undefined) {
            return this.mergeWithPrevious;
        }
        const previous = this.previousMessage;
        if (this.checkIfContinuousMessage()) {

            const timeIsClose = (time1, time2, ms) => {
                return Math.abs(time1 - time2) < ms;
            }
            const time1 = previous.getMessage().time;
            const time2 = this.getMessage().time;
            const time3 = previous.getMergedBlockTopBeautifiedMessage().message.getMessage().time;
            this.mergeWithPrevious = (timeIsClose(time1, time2, 1000) && timeIsClose(time2, time3, 10000)) ;

        }
        else {
            this.mergeWithPrevious = false;
        }
        console.log("[ConversationWindowLogMessage] Message.mergeWithPrevious", this.getMessage().text, this.mergeWithPrevious, this.checkIfContinuousMessage());
        return this.mergeWithPrevious;
    }

    checkIfContinuousMessage() {
        if (this.continuousMessage !== null && this.continuousMessage !== undefined) {
            return this.continuousMessage;
        }
        const previous = this.previousMessage;
        this.continuousMessage = previous ? previous.getMessage().textClass.v === TextClass.CONTENT.v && this.getMessage().textClass.v === TextClass.CONTENT.v : false;
        console.log("[ConversationWindowLogMessage] Checking if continuous message", this.getMessage().text, this.previousMessage && this.previousMessage.getMessage().textClass.v, this.continuousMessage);
        return this.continuousMessage;
    }

    provideLogInfo({previousMessage}) {
        this.previousMessage = previousMessage;
        this.checkIfMergeWithPrevious();
    }

}