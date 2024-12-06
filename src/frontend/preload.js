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



contextBridge.exposeInMainWorld("ansiAPI", {
    getANSITerminal: (data) => ipcRenderer.sendSync("get-ansi-terminal", data),
    getSimpleTerminal: (data) => ipcRenderer.sendSync("get-simple-terminal", data)
});


// contextBridge.exposeInMainWorld("frontendAPI", {
//     TextClass,
//     TerminalTextLogMessage,
//     TerminalCommandLogMessage,
//     Log,
//     getMessageFromInputElement,
//     getCommandFromInputElement
// })