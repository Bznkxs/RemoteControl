import {BaseChildProcessWrapper, ChildProcessWrapper} from "./child_process_wrapper.js";

const defaultListeners = {
    onSpawnedCallback: null,
    onExitCallback: null,
    onStdoutCallback: null,
    onStderrCallback: null,
    onStdinCallback: null
}

class CommandProcessor {
    constructor() {
        this.childProcess = new BaseChildProcessWrapper();
        this.listeners = defaultListeners;
    }

    connectSignals(listeners=defaultListeners) {
        for (const signal in listeners) {
            if (listeners[signal]) {
                this.listeners[signal] = listeners[signal];
            }
        }
    }

    createChildProcess(command, args) {
        this.childProcess = new ChildProcessWrapper(command, args, () => {
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
}

module.exports = { CommandProcessor };