const pty = require('node-pty');

class BaseChildProcessWrapper {
    constructor(...args) {
    }

    sendToChild = () => {}
    onStdout = () => {}
    onStderr = () => {}
    onExit = () => {}
    kill = () => {}
    isRunning = () => {}
}

class ChildProcessWrapper extends BaseChildProcessWrapper {
    constructor(command, args, onSpawnedCallback, options={
        env: process.env,
        cwd: process.cwd(),
        cols: 80,
        rows: 30,
    }) {
        super();
        this.childProcess = pty.spawn(command, args, options);

        this.isProcessRunning = true;
        this.childProcess.onExit(this.defaultOnExitListener);
        onSpawnedCallback();

        this.onDataListeners = [];
        this.onExitListeners = [];
    }

    sendToChild = (data) => {
        this.childProcess.write(data);
    }

    kill = () => {
        if (this.isProcessRunning) this.childProcess.kill();
    }

    onStdout = (callback) => {
        this.childProcess.onData(callback);
        this.onDataListeners.push(callback);
    }

    onStderr = (callback) => {
        callback("[Warning] Stderr is not supported in node-pty")
    }

    onExit = (callback) => {
        this.onExitListeners.push(callback);
        this.childProcess.onExit(callback);
    }

    defaultOnExitListener = (code) => {
        this.isProcessRunning = false;
        this.returnCode = code;
    }

    isRunning = () => {
        return this.isProcessRunning;
    }
}

module.exports = {BaseChildProcessWrapper, ChildProcessWrapper};