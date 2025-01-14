// const {BaseChildProcessWrapper, ChildProcessWrapper, SFTPWrapper} = require("./child_process_wrapper.js");

// ESM style:
import {BaseChildProcessWrapper, ChildProcessWrapper} from "./child_process_wrapper.js";
import {SFTPWrapper} from "./sftp_wrapper.js";
const defaultListeners = {
    onSpawnedCallback: null,
    onExitCallback: null,
    onStdoutCallback: null,
    onStderrCallback: null,
    onStdinCallback: null
}

export class CommandProcessor {
    constructor(name) {
        this.childProcess = new BaseChildProcessWrapper();
        this.listeners = {...defaultListeners};
        this.name = name;
    }

    connectSignals(listeners=defaultListeners) {
        console.log(`[CommandProcessor] ${this.name} connectSignals`)
        for (const signal in listeners) {
            if (listeners[signal]) {
                this.listeners[signal] = listeners[signal];
            }
        }
    }

    createChildProcess(message) {
        const childProcessClass = message.sftp ? SFTPWrapper : ChildProcessWrapper;
        this.childProcess = new childProcessClass(message.command, message.args, () => {
            if (this.listeners.onSpawnedCallback !== null) return this.listeners.onSpawnedCallback()
        });
        this.childProcess.onStdout((data) => {
            if (this.listeners.onStdoutCallback !== null) return this.listeners.onStdoutCallback(data);
        })
        this.childProcess.onStderr((data) => {
            if (this.listeners.onStderrCallback !== null) return this.listeners.onStderrCallback(data);
        })
        this.childProcess.onExit((code) => {
            if (this.listeners.onExitCallback !== null) return this.listeners.onExitCallback(code);
        })
    }

    sendToChild(data) {
        this.childProcess.sendToChild(data);
        if (this.listeners.onStdinCallback !== null) return this.listeners.onStdinCallback(data);
    }

    killChildProcess() {
        this.childProcess.kill();
    }

    changeChildToSFTP() {
        this.childProcess = new SFTPWrapper()
    }
}


// module.exports = { CommandProcessor };