// const { TextClass, TerminalTextLogMessage, TerminalCommandLogMessage } = require('./terminal_log_message.js');
import { parseAnsiMessage, getInputHintMarker, parseSimpleMessage } from "./parse_terminal_ansi_message.js";
import {TextClass} from "../shared/text_class.js";
import {TerminalCommandLogMessage, TerminalTextLogMessage} from "../shared/message.js";

// map element to the last cursor position
let previousInfo = new Map();

export
class BeautifiedLogMessage {
    constructor(message, previousInfo) {
        this.mergeWithPrevious = false;
        if (message instanceof TerminalTextLogMessage) {
            // if message is a command, convert it to a TerminalCommandLogMessage
            if (message.isLogSubclass(TerminalCommandLogMessage)) {
                message = message.to(TerminalCommandLogMessage);
            } else {  // if message is a text message, parse it with ANSI
                if (message.textClass.v === TextClass.CONTENT.v) {
                    console.log("Parsing message", message, previousInfo.message)
                    if (previousInfo && previousInfo.message) {
                        // merge the content with the previous content
                        if (previousInfo.message.textClass.v === TextClass.CONTENT.v) {
                            console.log("Comparing time", previousInfo.message.time, message.time)
                            const timeIsClose = (time1, time2) => {
                                return Math.abs(time1 - time2) < 1000;
                            }
                            if (timeIsClose(previousInfo.message.time, message.time)) {
                                this.mergeWithPrevious = true;
                            } else {
                                this.mergeWithPrevious = false;
                                console.log("Time is not close", previousInfo.message.time, message.time)
                            }
                        }
                    }
                    const {frag, cursor, mergeWithPrevious, lastOutputEndsWithN} = parseSimpleMessage(previousInfo.container,
                        message.text, previousInfo,
                        this.mergeWithPrevious);
                    this.mergeWithPrevious = mergeWithPrevious;
                    this.lastOutputEndsWithN = lastOutputEndsWithN;
                    message.ansiFragment = frag;
                }
            }
            this.getMessage = () => message;
            this.getBeautifiedMessage = (parseANSI=true) => {
                const beautifiedMessage = BeautifiedLogMessage.createMessageElement(message, parseANSI);
                console.log("Beautified message", beautifiedMessage);
                if (this.customInputHint) {
                    // add it before the first child of the messageContentContainer
                    beautifiedMessage.getElementsByClassName('messageContentContainer')[0].prepend(
                        this.customInputHint
                    );
                    console.log(beautifiedMessage.getElementsByClassName('messageContentContainer')[0]);
                    beautifiedMessage.getElementsByClassName(
                        'messageContentContainer'
                    )[0].classList.add('custom-input-hint');
                }

                beautifiedMessage.getElementsByClassName('metaInfoContainer')[0].appendChild(
                    document.createTextNode(JSON.stringify(previousInfo.cursor))
                );

                return beautifiedMessage;
            }
        } else {
            throw new Error('Message must be an instance of TerminalTextLogMessage');
        }
    }

    get beautifiedMessage() {
        return this.getBeautifiedMessage();
    }

    static createTimeStampElement(time) {
        const timeStamp = document.createElement('span');
        timeStamp.classList.add('timestamp');
        timeStamp.innerText = `[${time.toLocaleTimeString('en-US',
            {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3})
        }]`;
        return timeStamp;
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
     * @param {TerminalCommandLogMessage | TerminalTextLogMessage} message
     */
    static createMessageContentElement(message, parseANSI=true) {
        const messageContentElement = document.createElement('div');
        messageContentElement.classList.add('messageContentContainer');
        const contentElementClassForMessage = 'content-breakable-span';
        const contentElementClassForCommand = 'content-breakable-span';
        if (message instanceof TerminalCommandLogMessage) {
            messageContentElement.classList.add(contentElementClassForMessage);
            const commandElement = this.createContentElement(message.command, 'command');
            messageContentElement.appendChild(commandElement);
            message.args.forEach((arg) => {
                const argElement = this.createContentElement(arg);
                messageContentElement.appendChild(argElement);
            });
        } else if (message.textClass.v === TextClass.EXITCODE.v) {
            messageContentElement.classList.add(contentElementClassForCommand);
            const contentElement = this.createContentElement("Process finished with exit code", 'exitCode');
            messageContentElement.appendChild(contentElement);
            const exitCodeElement = this.createContentElement(message.text);
            messageContentElement.appendChild(exitCodeElement);
        } else {
            messageContentElement.classList.add(contentElementClassForMessage);
            if (parseANSI && message['ansiFragment']) {
                const contentElement = this.createContentElement(message['ansiFragment'], 'default');
                messageContentElement.appendChild(contentElement);
            }
            else {
                const contentElement = this.createContentElement(message.text, 'default');
                messageContentElement.appendChild(contentElement);
            }

        }
        if (message.isInput) {
            messageContentElement.classList.add('input');
        }
        console.log("Message content element", messageContentElement)
        return messageContentElement;
    }

    static createLogLevelElement = (message) => {
        const logLevelElement = document.createElement('div');
        logLevelElement.classList.add('logLevel');
        logLevelElement.innerText = message.textClass.v;
        return logLevelElement;
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

    static createMetaElement = (message) => {
        const metaElement = document.createElement('div');
        metaElement.classList.add('metaInfoContainer');
        const timeStampElement = this.createTimeStampElement(message.time);
        metaElement.appendChild(timeStampElement);
        const logLevelElement = this.createLogLevelElement(message);
        metaElement.appendChild(logLevelElement);
        const toggleVisibilityButton = this.createVisibilityButton();
        metaElement.appendChild(toggleVisibilityButton);
        return metaElement;

    }

    /**
     * Creates a message element with a timestamp and message content.
     * @param message
     * @returns {HTMLDivElement}
     */
    static createMessageElement(message, parseANSI=true) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('messageContainer');
        const metaElement = this.createMetaElement(message);
        console.log("Created meta element", metaElement);
        messageElement.appendChild(metaElement);
        const messageContentContainer = this.createMessageContentElement(message, parseANSI);
        messageElement.appendChild(messageContentContainer);
        return messageElement;
    }

    static isElementInputHint(element) {
        if (!element) return false;
        // check if a MessageContainerElement contains an input hint (e.g. "Enter your name: " or "/home/user$")
        if (element.classList.contains('messageContainer')) {
            const messageContent = element.getElementsByClassName('messageContentContainer')[0];
            const inputHintMarker = getInputHintMarker();
            return messageContent.getElementsByClassName(inputHintMarker.classList[0]).length > 0;
        }
    }


}

export
function writeMessageToElement(element, message) {
    // write message only if element has class 'log'
    if (element.classList.contains('logContainer')) {

        const lastElementChild = element.lastElementChild;
        if (!previousInfo.has(element)) {
            previousInfo.set(element, {cursor: {row: 0, col: 0}, buffer: null, element: lastElementChild, container: element});
        }
        const beautifiedLog = new BeautifiedLogMessage(message, previousInfo.get(element));
        if (message.isInput) {
            console.log("Message is input", message);
            if (BeautifiedLogMessage.isElementInputHint(lastElementChild)) {
                // make a deep copy of the input hint
                beautifiedLog.customInputHint = lastElementChild.getElementsByClassName(
                    'messageContentContainer'
                )[0].getElementsByTagName('span')[0].cloneNode(true);
                beautifiedLog.customInputHint.removeChild(beautifiedLog.customInputHint.lastElementChild);
                // remove the input hint
                element.removeChild(lastElementChild);
                console.log("Removed input hint: ", element);
            }

        }
        const contentToAppend = beautifiedLog.beautifiedMessage;
        console.log("We got the beautified message", contentToAppend);
        const comment = document.createComment("message.text");
        contentToAppend.appendChild(comment);

        for (let i = 0; i < message.text.split('\n').length; i++) {
            const comment = document.createComment(JSON.stringify(message.text.split('\n')[i]));
            contentToAppend.appendChild(comment);
        }
        // contentToAppend.innerHTML += "<!--message.text-->";
        // for each line in message.text, create a new comment line

        // for (let i = 0; i < message.text.split('\n').length; i++) {
        //     contentToAppend.innerHTML += `<!--${JSON.stringify(message.text.split('\n')[i])}-->`;
        // }
        element.appendChild(contentToAppend);
        // click the visibility button to hide the content if password
        if (message.password) {
            console.log("Clicking visibility button", contentToAppend)
            const button = contentToAppend.getElementsByClassName('contentVisibilityButton')[0];
            const messageContentContainer = button.parentElement.parentElement.getElementsByClassName('messageContentContainer')[0];
            const messageContentHTML = messageContentContainer.innerHTML;
            messageContentContainer.classList.toggle('secret');

            button.innerText = 'show';
            messageContentContainer.innerHTML = "<span class='default' style='font-weight: normal'>🔑🔑🔑🔑🔑🔑</span>"
            messageContentContainer.recover = () => {
                messageContentContainer.innerHTML = messageContentHTML;
            }

            // .click();
        }

        if (beautifiedLog.mergeWithPrevious) {
            // hide meta info
            contentToAppend.classList.add('mergedWithPrevious');
            // contentToAppend.getElementsByClassName('metaInfoContainer')[0].classList.add('hidden');
            // // only when cursor hovers over the message, the meta info will be shown
            // contentToAppend.addEventListener('mouseenter', () => {
            //     contentToAppend.getElementsByClassName('metaInfoContainer')[0].classList.remove('hidden');
            // });
            // contentToAppend.addEventListener('mouseleave', () => {
            //     contentToAppend.getElementsByClassName('metaInfoContainer')[0].classList.add('hidden');
            // });
        }
        previousInfo.set(element, {cursor: null, buffer: null, message: message, element: contentToAppend,
            lastOutputEndsWithN: beautifiedLog.lastOutputEndsWithN, container: element});

        contentToAppend.title = JSON.stringify(message.text);

    } else {
        throw new Error('HTMLElement must have class "logContainer"');
    }
}

// module.exports = { BeautifiedLogMessage, writeMessageToElement };