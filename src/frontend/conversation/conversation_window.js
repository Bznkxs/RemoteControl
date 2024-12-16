import {
    maintainScrollToBottom,
    remindTabLabel,
    toggleElementEnabled,
    updateElementInfoForScrollToBottom
} from "../elements/element_utils.js";
import {ConversationWindowLogMessage} from "./conversation_window_log_message.js";
import {TabPageElementWrapper} from "../elements/tab_element.js";

export class ConversationWindow extends TabPageElementWrapper {
    constructor(conversationName, id, conversationTabElementWrapper, eolGetter=null,
                {command="", stdin=""}={}) {
        super(conversationTabElementWrapper, conversationName, id);
        const logTabContent = this.tabContentElement;

        const logSection = document.createElement("div");
        logSection.classList.add("log-section");
        logTabContent.appendChild(logSection);
        const conversationContainer = document.createElement("div");
        conversationContainer.id = id;
        conversationContainer.classList.add("logContainer");
        this.conversationContainer = conversationContainer;
        logSection.appendChild(conversationContainer);
        const controlSection = document.createElement("div");
        controlSection.classList.add("control-section");
        const inputContainer = document.createElement("div");
        inputContainer.id = id + "-input-container";
        inputContainer.classList.add("input-container");
        const commandInput = document.createElement("input");
        commandInput.id = id + "-command-input";
        commandInput.type = "text";
        commandInput.placeholder = "Enter command";
        commandInput.classList.add("command-input");
        const commandInputLabel = document.createElement("label");
        commandInputLabel.htmlFor = commandInput.id;
        commandInputLabel.textContent = "";
        inputContainer.appendChild(commandInputLabel);
        inputContainer.appendChild(commandInput);
        this.commandInput = commandInput;
        console.log("[ConversationWindow] Command input created", commandInput)
        const stdinInput = document.createElement("input");
        stdinInput.id = id + "-stdin-input";
        stdinInput.type = "text";
        stdinInput.placeholder = "Enter stdin";
        stdinInput.classList.add("stdin-input");
        const stdinInputLabel = document.createElement("label");
        stdinInputLabel.htmlFor = stdinInput.id;
        stdinInputLabel.textContent = "";
        inputContainer.appendChild(stdinInputLabel);
        inputContainer.appendChild(stdinInput);
        this.stdinInput = stdinInput;
        const eolInput = document.createElement("input");
        eolInput.id = id + "-eol-input";
        eolInput.type = "text";
        eolInput.placeholder = "EOL";
        eolInput.classList.add("eol-input");
        const eolInputLabel = document.createElement("label");
        eolInputLabel.htmlFor = eolInput.id;
        eolInputLabel.textContent = "";
        inputContainer.appendChild(eolInput);
        inputContainer.appendChild(eolInputLabel);
        this.eolInput = eolInput;
        this.eolInputLabel = eolInputLabel;
        controlSection.appendChild(inputContainer);

        const clickableContainer = document.createElement("div");
        clickableContainer.id = id + "-clickable-container";
        clickableContainer.classList.add("clickable-container");
        const sendButton = document.createElement("div");
        sendButton.id = id + "-send-button";
        sendButton.textContent = "Press to send input";
        sendButton.classList.add("button");
        clickableContainer.appendChild(sendButton);
        this.sendButton = sendButton;
        const commandButton = document.createElement("div");
        commandButton.id = id + "-command-button";
        commandButton.textContent = "Press to send command";
        commandButton.classList.add("button");
        clickableContainer.appendChild(commandButton);
        this.commandButton = commandButton;
        const stopButton = document.createElement("div");
        stopButton.id = id + "-stop-button";
        stopButton.textContent = "Press to stop";
        stopButton.classList.add("button");
        clickableContainer.appendChild(stopButton);
        this.stopButton = stopButton;
        controlSection.appendChild(clickableContainer);

        logTabContent.appendChild(controlSection);
        // this.controlSection = controlSection;

        this.id = id;
        this.sendRawInputListeners = [];
        this.sendSignalListeners = [];
        this.sendCommandListeners = [];
        this.globalEventListeners = [];
        this.windowLogMessages = []

        this.getInputString = () => {
            return this.stdinInput.value;
        }

        this.getCommandString = () => {
            return this.commandInput.value;
        }

        this.setEOLGetter(eolGetter);
        this.changeEOLListener = (eol) => {
            if (['\n', '\r\n', '\r', '\n\r', ''].indexOf(eol) === -1) {
                return false;
            }
            this._localEOL = eol;
            console.log("[ConversationWindow] EOL changed to: " + eol)
            return true;
        };

        this.sendButton.onclick = () => {
            for (const listener of this.sendRawInputListeners) {
                const inputString = this.getInputString();
                console.log("[ConversationWindow] Sending input: " + JSON.stringify(inputString));
                listener(inputString);
            }
        }
        this.commandButton.onclick = () => {
            for (const listener of this.sendCommandListeners) {
                const commandString = this.getCommandString();
                console.log("[ConversationWindow] Sending command: " + JSON.stringify(commandString));
                const options = {password: false};
                listener(commandString, options);
            }
        }
        this.stopButton.onclick = () => {
            for (const listener of this.sendSignalListeners) {
                console.log("[ConversationWindow] Sending signal: stop");
                listener("stop");
            }
        }

        this.deserializeEOL = (eolString) => {
            try {
                return JSON.parse('"' + eolString + '"');
            } catch (e) {
                return null;
            }
        }

        this.eolInput.addEventListener("input", () => {

            const EOLFromInput = this.eolInput.value;
            const eol = this.deserializeEOL(EOLFromInput);
            if (this.changeEOL(eol)) {
                console.log("[ConversationWindow] EOL input changed to: " + this.stringifyEOL(eol))
            };
        })

        this.commandInput.addEventListener("input", this.syncCommandButtonEnabled);
        this.commandInput.addEventListener("input", () => {
            this.changeEOLBasedOnCommand(this.commandInput.value);
        })

        this.conversationContainer.addEventListener("scroll", () => {
            updateElementInfoForScrollToBottom(this.conversationContainer);
        });


        const logTabLabel = this.tabLabelElement

        const maintainScrollToBottomCallback = () => {
            remindTabLabel(logTabLabel);
            maintainScrollToBottom(this.conversationContainer);
        }

        const conversationContainerObserver = new MutationObserver(maintainScrollToBottomCallback);
        this.registerGlobalEventListener(
            logTabLabel,
            "click",
            maintainScrollToBottomCallback
        );
        conversationContainerObserver.observe(this.conversationContainer,
            {childList: true, attributes: true, subtree: true});

        // initialize values
        this.stdinInput.value = stdin;
        this.commandInput.value = command;
        updateElementInfoForScrollToBottom(this.conversationContainer);
        toggleElementEnabled(this.stdinInput, false);
        toggleElementEnabled(this.sendButton, false);
        toggleElementEnabled(this.stopButton, false);
        this.commandButtonNotForceDisabled = true;
        this.syncCommandButtonEnabled();




        this.scriptSpawnedListener = (arg, timeStamp) => {
            console.log("[ConversationWindow] Script spawned: " + arg + " at " + timeStamp);
            toggleElementEnabled(this.stdinInput, true);
            toggleElementEnabled(this.sendButton, true);
            toggleElementEnabled(this.stopButton, true);
            toggleElementEnabled(this.commandInput, false);
            this.commandButtonNotForceDisabled = false;
            this.syncCommandButtonEnabled();
        }
        this.exitCodeListener = (message) => {
            console.log("[ConversationWindow] Script exited with code: " + message.text);
            toggleElementEnabled(this.stdinInput, false);
            toggleElementEnabled(this.sendButton, false);
            toggleElementEnabled(this.stopButton, false);
            toggleElementEnabled(this.commandInput, true);
            this.commandButtonNotForceDisabled = true;
            this.syncCommandButtonEnabled();
        }
    }

    setEOLGetter = (eolGetter) => {
        if (eolGetter) {
            this.getEOL = eolGetter;
        } else {
            this._localEOL = "\n";
            this.getEOL = () => {
                return this._localEOL;
            }
        }
        this.syncEOL(this.getEOL());
    }

    registerGlobalEventListener = (element, eventName, callback) => {
        element.addEventListener(eventName, callback);
        this.globalEventListeners.push([element, eventName, callback]);
    }

    syncCommandButtonEnabled = () => {
        console.log("[ConversationWindow] Syncing command button enabled", this.commandInput)
        toggleElementEnabled(this.commandButton, this.commandInput.value.length > 0
            && this.commandButtonNotForceDisabled);
    }

    destroy = () => {
        if (super.destroy()) {
            for (const [element, eventName, callback] of this.globalEventListeners) {
                element.removeEventListener(eventName, callback);
            }
        }

    }


    addMessage = (message) => {
        console.log("[ConversationWindow] Adding message", message)
        const windowLogMessage = new ConversationWindowLogMessage(message);
        if (this.windowLogMessages.length > 0) {
            const lastWindowLogMessage = this.windowLogMessages[this.windowLogMessages.length - 1];
            windowLogMessage.provideLogInfo({previousMessage: lastWindowLogMessage});
        }

        const logMessageElement = windowLogMessage.beautifiedMessage;

        console.log("[ConversationWindow] Added message, got otherReturnMessages", windowLogMessage.otherReturnMessages)
        if (windowLogMessage.otherReturnMessages) {
            windowLogMessage.otherReturnMessages.forEach((otherReturnMessage) => {
                if (otherReturnMessage.action === "set-title") {
                    this.changeTabName(otherReturnMessage.text);
                }
            });
        }

        if (logMessageElement) {

            this.conversationContainer.appendChild(logMessageElement);
            if (message.password) {
                const button = logMessageElement.getElementsByClassName('contentVisibilityButton')[0];
                button.click();
            }
            this.windowLogMessages.push(windowLogMessage);
        }
    }

    onSendInputWithEOL = (callback) => {
        this.sendRawInputListeners.push(callback);
    }

    onSendSignal = (callback) => {
        this.sendSignalListeners.push(callback);
    }

    onSendCommand = (callback) => {
        this.sendCommandListeners.push(callback);
    }

    stringifyEOL = (eol) => {
        return JSON.stringify(eol).replaceAll('"', '') || "\"\"";
    }

    /**
     * New EOL comes from context. Update the EOL input field and the EOL variable.
     * EOL
     * @param eol
     */
    syncEOL = (eol) => {
        this.eolInput.value = this.stringifyEOL(eol);
        this.updateEOLDisplay(eol);
    }

    /**
     * Update the EOL in display
     * @param eol
     */
    updateEOLDisplay = (eol) => {
        if (this.eolInput.value !== this.stringifyEOL(eol)) {
            this.eolInputLabel.textContent = "Using EOL: " + this.stringifyEOL(eol);
            this.eolInputLabel.classList.add("error");
        } else {
            this.eolInputLabel.textContent = "";
            this.eolInputLabel.classList.remove("error");
        }
    }

    /**
     * New EOL comes from elements of the ConversationWindow object. Update the EOL variable
     * @param eol
     */
    changeEOL = (eol) => {
        console.log("[ConversationWindow] EOL changed to: " + this.stringifyEOL(eol))
        const allowChange = this.changeEOLListener(eol);
        if (allowChange) {
            this.updateEOLDisplay(eol);
        } else {
            this.updateEOLDisplay(this.getEOL());
        }
        return allowChange;
    }

    onChangeEOL = (callback) => {
        this.changeEOLListener = callback;
    }

    clear = () => {
        this.conversationContainer.innerHTML = "";
    }

    changeEOLBasedOnCommand = (command) => {
        if (command.startsWith('powershell.exe')) {
            this.changeEOL("\r");
        }
        if (command.startsWith('cmd.exe')) {
            this.changeEOL("\r");
        }
        if (command.startsWith('ssh')) {
            this.changeEOL("\n");
        }
    }
}