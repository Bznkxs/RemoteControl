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

// const {
//     TerminalTextLogMessage, TextClass,
//     getMessageFromInputElement, getCommandFromInputElement,
//     Log, TerminalCommandLogMessage
// } = window.frontendAPI;

import {getCommandFromInputElement, getMessageFromInputElement} from "./get_message_from_element.js";
import {Log} from "./terminal_log.js";
import {RemoteControlContext} from "./automaton/context.js";
import {deserializeFunction} from "./serialize_deserialize.js";
import {SimpleANSIParsingLog} from "./ansi_parsing_terminal_log.js";
import {parseTerminalMessageText} from "./parse_terminal_ansi_message.js";
import {TextClass} from "../shared/text_class.js";
import {TerminalTextLogMessage} from "../shared/message.js";
import {
    maintainScrollToBottom, remindTabLabel,
    toggleElementEnabled,
    toggleElementVisibility,
    updateElementInfoForScrollToBottom
} from "./element_utils";

console.log('👋 This message is being logged by "renderer.js", included via webpack');


// Definitions of elements

const sshButton = document.getElementById("ssh-button");
const sendInputButton = document.getElementById("send-input-button");
const exitCode = document.getElementById("exit-code");
const stdoutContent = document.getElementById("stdout-content");
const stderrContent = document.getElementById("stderr-content");
const logContent = document.getElementById("log-content");
const stdInput = document.getElementById("std-input");
const eolInput = document.getElementById("eol-input");
const eolInputLabel = document.getElementById("eol-input-label");
const commandInput = document.getElementById("command-input");
const stopButton = document.getElementById("stop-button");
const commandModeDefaultRadio = document.getElementById("default-mode");
const commandModePtyRadio = document.getElementById("pty-mode");
const logTab = document.getElementById("log-tab");
const fileTab = document.getElementById("file-tab");
const logTabLabel = document.getElementById("log-tab-label");
const fileTabLabel = document.getElementById("file-tab-label");
const loadFileButton = document.getElementById("load-file-button");
const fileInput = document.getElementById("file-input");
const fileContent = document.getElementById("file-content");
const startFileButton = document.getElementById("start-file-button");
const stopFileButton = document.getElementById("stop-file-button");

// Definitions of constants

const latestStdoutLog = new Log([], [
    // stdoutContent
]);
const latestStderrLog = new Log([], [
    // stderrContent
]);
const latestExitCodeLog = new Log([], [
    // exitCode
]);
const inputLog = new Log([], []);
const log = new Log.MonitoringLog([latestStderrLog, latestStdoutLog, latestExitCodeLog, inputLog], [logContent]);
new SimpleANSIParsingLog(latestStdoutLog);
new SimpleANSIParsingLog(latestStderrLog);
new SimpleANSIParsingLog(inputLog);
new SimpleANSIParsingLog(log);

// Definitions of global vars

let EOL = "";


// Definitions of functions




const changeCommandMode = (mode, changeRadio=true) => {
    console.assert(mode === "default" || mode === "pty");
    if (changeRadio) {
        if (mode === "default") {
            commandModeDefaultRadio.checked = true;
            commandModePtyRadio.checked = false;
        } else {
            commandModeDefaultRadio.checked = false;
            commandModePtyRadio.checked = true;
        }
    } else {
        console.assert(getCommandMode() === mode)
    }
    window.electronAPI.changeCommand(mode);
}

const getCommandMode = () => {
    if (commandModeDefaultRadio.checked) {
        return "default";
    } else {
        return "pty";
    }
}

function changeEOL(newEOL, recursive=true) {
    console.log("Changing EOL to: ", JSON.stringify(newEOL), new Error())
    EOL = newEOL;
    if (recursive) {
        eolInput.value = JSON.stringify(newEOL).replaceAll('"', '');
    }
}

function setTab(tabName) {
    if (tabName === "logTab") {
        logTabLabel.classList.add("active");
        logTabLabel.classList.remove("remind");
        fileTabLabel.classList.remove("active");
        toggleElementVisibility(logTab, true);
        toggleElementVisibility(fileTab, false);
    } else {
        logTabLabel.classList.remove("active");
        fileTabLabel.classList.add("active");
        fileTabLabel.classList.remove("remind");
        toggleElementVisibility(logTab, false);
        toggleElementVisibility(fileTab, true);
    }
}


// actions

function changeSSHButtonEnabledForListeners() {
    toggleElementEnabled(sshButton, commandInput.value !== "");
}

function sendCommandMessage(commandLogMessage) {
    console.log(commandLogMessage.command, commandLogMessage.args);
    console.log(commandLogMessage.argList);
    console.log(commandLogMessage);
    inputLog.log(commandLogMessage);
    latestStdoutLog.clear();
    latestStderrLog.clear();
    latestExitCodeLog.clear();
    window.electronAPI.runScript(commandLogMessage.command, commandLogMessage.args);
}



function sendInputMessage(inputLogMessage) {

    console.log("Sending input: ", JSON.stringify(inputLogMessage.text + EOL));
    inputLog.log(inputLogMessage);
    window.electronAPI.sendInput(inputLogMessage.text + EOL);
}

function createNewContentLog (name, arg, timeStamp) {
    console.log("Script stdout: ", name, arg, timeStamp);
    const {data, ansiOutputStream} = arg;
    const message = new TerminalTextLogMessage({
        text: data,
        ansiOutputStream: ansiOutputStream,
        time: timeStamp,
        textClass: TextClass.CONTENT
    })
    if (ansiOutputStream) {
        message.ansiOutputStream = ansiOutputStream;
        message.ansiText = parseTerminalMessageText(name, message);
        message.rawText = message.text;
        message.text = message.ansiText;
    }


    return message;
}

function logFileContent(content) {
    fileContent.innerHTML = content;
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

// Initial states

commandInput.value = "powershell.exe";
changeEOL("\r");
fileInput.value="exampleStorage/ssh_dai.js"
stdInput.value = "echo llllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllll";
toggleElementEnabled(stdInput, false);
toggleElementEnabled(sendInputButton, false);
toggleElementEnabled(stopButton, false);
toggleElementEnabled(sshButton, commandInput.value !== "");
changeCommandMode("pty");
toggleElementVisibility(stdoutContent, false);
toggleElementVisibility(stderrContent, false);
toggleElementVisibility(exitCode, false);
setTab("fileTab");
updateElementInfoForScrollToBottom(logContent);



// proxy
const proxyContext = new RemoteControlContext({
    write: sendInputMessage,
    execute: sendCommandMessage,
    readFile: window.electronAPI.readFileSync,
    listeners: [],
    onData: function(callback) {
        const name = "proxyContextOnDataListener-" + this.listeners.length;
        const listener = (arg, timeStamp) => {
            const newMessage = createNewContentLog(name, arg, timeStamp);
            callback(newMessage);
        }
        this.listeners.push(['script-stdout', window.electronAPI.onStdout(listener)]);
        console.log("OnData add listener", this.listeners);

    },
    removeListeners: function() {
        console.log("removeListeners", this.listeners);
        this.listeners.forEach(([channel, listener]) => {
            window.electronAPI.removeListener(channel, listener);
        });
        this.listeners = [];
    },
    stopCommand: function() {
        window.electronAPI.stopScript();
    },
    onExit: function(callback) {
        this.listeners.push(['script-close', window.electronAPI.onScriptRan(callback)]);

    },
    changeEOL: changeEOL
})



// Event listeners

commandInput.addEventListener("input", changeSSHButtonEnabledForListeners);

sshButton.addEventListener("click", () => {
    let commandLogMessage = getCommandFromInputElement(commandInput);
    sendCommandMessage(commandLogMessage);
});

sendInputButton.addEventListener("click", () => {
    let input = getMessageFromInputElement(stdInput);
    sendInputMessage(input);
});

stopButton.addEventListener("click", () => {
    window.electronAPI.stopScript();
});

commandModeDefaultRadio.addEventListener("change", () => {
    changeCommandMode("default", false);
});

commandModePtyRadio.addEventListener("change", () => {
    changeCommandMode("pty", false);
});

logTabLabel.addEventListener("click", () => {
    setTab("logTab");

});

fileTabLabel.addEventListener("click", () => {
    setTab("fileTab");

});

loadFileButton.addEventListener("click", () => {
    const filePath = fileInput.value;
    const content = window.electronAPI.readFileSync(filePath);
    setRemoteControlSequence(content, proxyContext);
});

const callback = (mutationsList, observer) => {
    // console.log("Mutation observed")
    remindTabLabel(logTabLabel);
    maintainScrollToBottom(logContent);
    // for (const mutation of mutationsList) {
    //     if (mutation.type === 'childList') {
    //
    //     }
    // }

}

logTabLabel.addEventListener("click", callback);

const observer = new MutationObserver(callback);
const targetNode = logContent;
observer.observe(targetNode, {childList: true, attributes: true, subtree: true});

logContent.addEventListener("scroll", () => {
    // console.log("Scrolling")
    updateElementInfoForScrollToBottom(logContent);
});

eolInput.addEventListener("input", () => {
    const supportedEOLVocab = ["\r", "\n"];
    let eol = eolInput.value;
    eol = eol.replaceAll("'", '"');
    if (!eol.startsWith('"')) {
        eol = '"' + eol + '"';
    }
    try {
        eol = JSON.parse('"' + eolInput.value + '"');
        for (let i = 0; i < eol.length; i++) {
            if (!supportedEOLVocab.includes(eol[i])) {
                throw new Error("Unsupported EOL character");
            }
        }
        changeEOL(eol, false);
        eolInputLabel.innerText = "";
        eolInput.classList.remove("error");
    } catch (e) {
        eolInput.classList.add("error");
        eolInputLabel.innerText = "Using " + (JSON.stringify(EOL).replaceAll('"', '') || "\"\"");

    }


});


/** Event listeners for IPC
 *
 */

window.electronAPI.onScriptSpawned((arg, timeStamp) => {
    toggleElementEnabled(commandInput, false);
    toggleElementEnabled(sshButton, false);
    toggleElementEnabled(stdInput, true);
    toggleElementEnabled(sendInputButton, true);
    toggleElementEnabled(stopButton, true);
});

window.electronAPI.onScriptRan((arg, timeStamp) => {
    console.log("Script ran with code: ", arg);
    latestExitCodeLog.log(new TerminalTextLogMessage({
        text: String(arg),
        time: timeStamp,
        textClass: TextClass.EXITCODE
    }));
    toggleElementEnabled(commandInput, true);
    toggleElementEnabled(sshButton, true);
    toggleElementEnabled(stdInput, false);
    toggleElementEnabled(sendInputButton, false);
    toggleElementEnabled(stopButton, false);
});

window.electronAPI.onStdout((arg, timeStamp) => {
    latestStdoutLog.log(createNewContentLog("script-stdout", arg, timeStamp));
});

window.electronAPI.onStderr((arg, timeStamp) => {
    console.log("Script stderr: ", arg);
    latestStderrLog.log(createNewContentLog(null, arg, timeStamp));
});

// some test operations

// const commandSeqString = window.electronAPI.readFileSync("exampleStorage/ssh_dai_raw_bad_example.js");
// console.log(commandSeqString);
// const commandFunc = deserializeFunction(commandSeqString);
// console.log(commandFunc);
// const commandSequence = commandFunc(proxyContext);
// commandSequence.forEach((command) => {
//     command();
// });