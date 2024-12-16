// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts


const { contextBridge, ipcRenderer } = require('electron');

// const path = require("path");
// const {TextClass, TerminalTextLogMessage, TerminalCommandLogMessage} = require(path.join(__dirname,
//     "./terminal_log_message"));
// const { Log } = require("./terminal_log");
// const { getMessageFromInputElement, getCommandFromInputElement } = require(path.join(__dirname,
//     "./get_message_from_element"));

// const pty = require('node-pty');
//
//
// let childProcess = null;
// let isProcessRunning = false;
// let sendToChild = null;
//
// function createChildProcess(command, args) {
//     console.log("CommandPTY create child process", command, args)
//     childProcess = pty.spawn(command, args, {
//         env: process.env,
//         cwd: process.cwd()
//     });
//     console.log("CommandPTY create child process")
//     sendToChild = (data) => {
//         console.log(`Sending to child: ${data}`);
//         childProcess.write(`${data}\n`); // Send input to child's stdin
//     };
//
//     childProcess.onData((data) => {
//         console.log(`Received from child: ${data.toString().trim()}`);
//     });
//     isProcessRunning = true;
//     childProcess.onExit( (code) => {
//         console.log(`Child process exited with code ${code}`);
//         isProcessRunning = false;
//     });
//     console.log("Command pty create child process")
// }

let apis = {
    createChildProcess: (command, args) => {
        createChildProcess(command, args);
    },
    sendToChild: (data) => {
        sendToChild(data);
    },
    runScript: (command, args) => {
        console.log("runScript", command, args)
        ipcRenderer.send('run-script', command, args);
    },
    onScriptSpawned: (callback) => {
        ipcRenderer.on('script-spawn', (event, arg, timeStamp) => {

            callback(arg, timeStamp);
        });
    },
    onScriptRan: (callback) => {
        const listener = (event, arg, timeStamp) => {
            console.log("script-close", arg)
            console.log(callback)
            try {
                callback(arg, timeStamp);
            } catch (e) {
                console.log(e)
            }

        };
        ipcRenderer.on('script-close', listener);
        return listener;
    },
    onStdout: (callback) => {
        // ipcRenderer.on('script-stdout', (event, arg, timeStamp) => {
        //     callback(arg, timeStamp);
        // });

        const listener = (event, arg, timeStamp) => {
            console.log("script-stdout", event, arg, timeStamp)
            console.log(callback, typeof callback);
            callback(arg, timeStamp);
        }
        console.log("Added callback", callback, listener)
        ipcRenderer.on('script-stdout', listener);
        return listener;
    },
    onStderr: (callback) => {
        ipcRenderer.on('script-stderr', (event, arg, timeStamp) => {
            callback(arg, timeStamp);
        });
    },
    removeListener: (channel, listener) => {
        ipcRenderer.removeListener(channel, listener);
    },
    sendInput: (input) => {
        ipcRenderer.send('send-input', input);
    },
    stopScript: () => {
        ipcRenderer.send('stop-script');
    },
    changeCommand: (command) => {
        ipcRenderer.send('change-command', command);
    },
    readFileSync: (path) => ipcRenderer.sendSync('read-file', path)

};


contextBridge.exposeInMainWorld('electronAPI', apis)
const dummy = {electronAPI: apis};
function unused(...args) {}
unused(dummy);


contextBridge.exposeInMainWorld("ansiAPI", {
    getANSITerminal: (data) => ipcRenderer.sendSync("get-ansi-terminal", data),
    getSimpleTerminal: (data) => ipcRenderer.sendSync("get-simple-terminal", data)
});

class Channel {
    constructor(channelId) {
        this.channelId = channelId;
        ipcRenderer.send('create-channel', channelId);
        this.callbacks = [];
    }

    destroy() {
        ipcRenderer.send('remove-channel', this.channelId);
        this.callbacks.forEach(([channelName, listener]) => {
            ipcRenderer.removeListener(channelName, listener);
        });
    }

    sendInput(inputString, options) {
        ipcRenderer.send('channel-send-input-' + this.channelId, inputString, options);
    }

    sendCommand(commandString) {
        ipcRenderer.send('channel-send-command-' + this.channelId, commandString);
    }

    sendSignal(signal) {
        ipcRenderer.send('channel-signal-' + this.channelId, signal);
    }

    onEvent(channelName, callback) {
        const listener = (event, arg) => {
            try {
                callback(arg);
            } catch (e) {
                console.log(e, e.stack);
            }

        }
        ipcRenderer.on(channelName, listener);
        this.callbacks.push([channelName, listener]);
    }

    removeEventListener(channelName, listener) {
        ipcRenderer.off(channelName, listener);
        this.callbacks = this.callbacks.filter(([_, cb]) => cb !== listener);
    }

    onSerializedMessage(callback) {
        this.onEvent('channel-serialized-message-' + this.channelId, callback);
    }

    removeSerializedMessageListener(callback) {
        this.removeEventListener('channel-serialized-message-' + this.channelId, callback);
    }

    onScriptSpawned(callback) {
        this.onEvent('channel-script-spawn-' + this.channelId, callback);
    }

}
const communicationAPI = {
    channels : {},
    createChannel: (channelId) => {
        communicationAPI.channels[channelId] = new Channel(channelId);
    },
    removeChannel: (channelId) => {
        communicationAPI.channels[channelId].destroy();
        delete communicationAPI.channels[channelId];
    },
    sendInput: (channelId, inputString, options) => {
        communicationAPI.channels[channelId].sendInput(inputString, options);
    },
    sendSignal: (channelId, signal) => {
        communicationAPI.channels[channelId].sendSignal(signal);
    },
    sendCommand: (channelId, commandString) => {
        communicationAPI.channels[channelId].sendCommand(commandString);
    },
    onSerializedMessage: (channelId, callback) => {
        communicationAPI.channels[channelId].onSerializedMessage(callback);
    },
    removeSerializedMessageListener: (channelId, callback) => {
        communicationAPI.channels[channelId].removeSerializedMessageListener(callback);
    },
    onScriptSpawned: (channelId, callback) => {
        communicationAPI.channels[channelId].onScriptSpawned(callback);
    }
};

contextBridge.exposeInMainWorld('communicationAPI', communicationAPI);