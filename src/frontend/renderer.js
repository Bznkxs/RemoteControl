/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */


// Imports


import {RemoteControlContext} from "./automaton/context.js";
import {deserializeFunction} from "./automaton/serialize_deserialize.js";
import {TabElementWrapper} from "./elements/tab_element.js";
import {VisualizedConversationManager} from "./conversation/conversation_manager.js";
import {SearchWidget} from "./search/search_widget.js";
import {ChatGPTWidget} from "./chatgpt/chatgpt_widget.js";

console.log('👋 This message is being logged by "renderer.js", included via webpack');


// Definitions of elements

function unused(...args) {}

const functionalityTabWrapper = new TabElementWrapper(document.body, "parent-tab");
const terminalEmulatorTabPageElementWrapper = functionalityTabWrapper.createTab({tabName: "Terminal Emulator"});
const loadFileTabPageElementWrapper = functionalityTabWrapper.createTab({tabName: "Load File"});
const chatGPTTabPageElementWrapper = functionalityTabWrapper.createTab({tabName: "ChatGPT"});

// create file tab

const fileTabWrapper = new TabElementWrapper(loadFileTabPageElementWrapper.tabContentElement, "file-tab");
const fileTabContentWrapper = fileTabWrapper.createTab({tabName: "File"});
const fileTabContent = fileTabContentWrapper.tabContentElement;
const fileContainerFrame = document.createElement("div");
fileContainerFrame.id = fileTabContentWrapper.id + "-file-container-frame";
fileContainerFrame.classList.add("frame");
fileTabContent.appendChild(fileContainerFrame);
const fileContainer = document.createElement("div");
fileContainer.id = fileTabContentWrapper.id + "-file-container";
fileContainer.classList.add("fileContainer");
fileContainerFrame.appendChild(fileContainer);
const fileControlSection = document.createElement("div");
fileControlSection.id = fileTabContentWrapper.id + "-file-control-section";
fileControlSection.classList.add("control-section");
fileTabContent.appendChild(fileControlSection);
const fileInputContainer = document.createElement("div");
fileInputContainer.id = fileTabContentWrapper.id + "-file-input-container";
fileInputContainer.classList.add("input-container");
fileControlSection.appendChild(fileInputContainer);
const fileInputLabel = document.createElement("label");
fileInputLabel.id = fileTabContentWrapper.id + "-file-input-label";
fileInputLabel.innerText = "File path: ";
fileInputContainer.appendChild(fileInputLabel);
const fileInput = document.createElement("input");
fileInput.id = fileTabContentWrapper.id + "-file-input";
fileInputLabel.htmlFor = fileInput.id;
fileInput.type = "text";
fileInputContainer.appendChild(fileInput);
const fileClickableContainer = document.createElement("div");
fileClickableContainer.id = fileTabContentWrapper.id + "-file-clickable-container";
fileClickableContainer.classList.add("clickable-container");
fileControlSection.appendChild(fileClickableContainer);
const loadFileButton = document.createElement("div");
loadFileButton.id = fileTabContentWrapper.id + "-load-file-button";
loadFileButton.classList.add("button");
loadFileButton.innerText = "Load File";
fileClickableContainer.appendChild(loadFileButton);
const stopFileButton = document.createElement("div");
stopFileButton.id = fileTabContentWrapper.id + "-stop-file-button";
stopFileButton.classList.add("button");
stopFileButton.innerText = "Stop";
fileClickableContainer.appendChild(stopFileButton);
const startFileButton = document.createElement("div");
startFileButton.id = fileTabContentWrapper.id + "-start-file-button";
startFileButton.classList.add("button");
startFileButton.innerText = "Start";
fileClickableContainer.appendChild(startFileButton);

// create chatGPT tab
const chatGPTWidget = new ChatGPTWidget(chatGPTTabPageElementWrapper, window.chatGPTAPI);


const visualizedConversationManager = new VisualizedConversationManager(
    "visualizedConversationManager",
    window.communicationAPI,
    terminalEmulatorTabPageElementWrapper
)

visualizedConversationManager.tabElementWrapper.defaultNewTabConfig.otherConfig = {command: "powershell.exe", eol: "\r"};

const conversation = visualizedConversationManager.createConversation({command: "!ubuntu.exe", stdin: "sftp dai", eol: "\n"})


function logFileContent(content) {
    fileContainer.innerHTML = content;
    const targetSpan = document.getElementById("highlightedLine");
    if (targetSpan) {
        targetSpan.scrollIntoView();
    }
}

function setRemoteControlSequence(commandSeqString, proxyContext) {
    console.log(proxyContext)
    proxyContext.callables.removeListeners();
    console.log(commandSeqString);
    const commandFunc = deserializeFunction(commandSeqString);
    logFileContent(commandSeqString);
    proxyContext.onGettingActionInfo = (info) => {
        if (info.lineOfCall) {
            const {callerFunction, callerRow, callerColumn} = info.lineOfCall;
            console.log("Line of call: ", callerFunction, callerRow, callerColumn);
            // insert a <span> tag to highlight the row
            const lines = commandSeqString.split("\n");
            const highlightedLine = `<span id="highlightedLine" style="background-color: yellow">${lines[callerRow-3]}</span>`;
            unused(highlightedLine);
            lines[callerRow-3] = highlightedLine;
            for (let i = 0; i < lines.length; i++) {
                lines[i] = `<span style="display: flex"><span style="width: 3rem">${i+1}</span> <span style="display: inline-block">${lines[i]}</span></span>`;
            }
            logFileContent(lines.join("\n"));
        }
    }
    console.log(commandFunc);
    const commandSequence = commandFunc(proxyContext);
    commandSequence.forEach((command) => {
        command();
    });
}

fileInput.value="test/sftp.js"


// proxy
const proxyContext = new RemoteControlContext({
    write: conversation.sendInputWithEOL,
    execute: conversation.sendCommand,
    readFile: window.electronAPI.readFileSync,
    listeners: [],
    onData: function(callback) {
        const realCallback = (data) => {
            if (data.textClass.isContent()) {
                callback(data.text);
            }
        }
        conversation.onMessage(realCallback);
        this.listeners.push(['script-stdout', realCallback]);
        console.log("OnData add listener", this.listeners);

    },
    removeListeners: function() {
        console.log("removeListeners", this.listeners);
        this.listeners.forEach(([channel, listener]) => {
            if (channel === "script-stdout") {
                conversation.removeMessageListener(listener);
            }
            else if (channel === "script-close") {
                conversation.removeExitCodeListener(listener);
            }
        });
        this.listeners = [];
    },
    stopCommand: function() {
        conversation.sendSignal(9);
    },
    onExit: function(callback) {
        this.listeners.push(['script-close', callback]);
        conversation.onExitCode(callback);
    },
    changeEOL: conversation.setEOL
})



// Event listeners


loadFileButton.addEventListener("click", () => {
    const filePath = fileInput.value;
    const content = window.electronAPI.readFileSync(filePath);
    setRemoteControlSequence(content, proxyContext);
});

// loadFileButton.click();


const searchWidget = new SearchWidget();
visualizedConversationManager.tabElementWrapper.onSelectedTab((tab) => {
    updateSearchWidgetStatus();
});
const updateSearchWidgetStatus = () => {
    if (functionalityTabWrapper.currentTab === terminalEmulatorTabPageElementWrapper && visualizedConversationManager.tabElementWrapper.currentTab) {
        searchWidget.setDisabled(false);
        searchWidget.selectContainer(visualizedConversationManager.tabElementWrapper.currentTab.conversationContainer);
    } else {
        searchWidget.setDisabled(true);
    }
}
visualizedConversationManager.tabElementWrapper.onTabChange((e) => {
    updateSearchWidgetStatus();
})
functionalityTabWrapper.onSelectedTab((tab) => {
    console.log("[Renderer] Selected tab", tab);
    updateSearchWidgetStatus();
})