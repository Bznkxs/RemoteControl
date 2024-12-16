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
        if (this.isRunning()) {
            this.childProcess.write(data);
        }

    }

    kill = () => {
        if (this.isRunning()) {
            try {
                console.log("[ChildProcessWrapper] Killing child process", this.childProcess.pid)
                this.isProcessRunning = false;  // to avoid multiple kill calls
                this.childProcess.removeAllListeners();
                process.kill(this.childProcess.pid);  // to avoid EPipe error
            }
            catch (e) {
                console.log("[ChildProcessWrapper] Error killing child process", e)
            }
        }
    }

    onStdout = (callback) => {
        this.childProcess.onData(callback);
        this.onDataListeners.push(callback);
    }

    onStderr = (callback) => {
        console.warn("[ChildProcessWrapper] Warning: Stderr is not supported in node-pty")
    }

    onExit = (callback) => {
        this.onExitListeners.push(callback);
        this.childProcess.onExit(callback);
    }

    defaultOnExitListener = (e) => {
        this.isProcessRunning = false;
        this.returnCode = e;
        console.log("[ChildProcessWrapper] Process exited with code", e);
    }

    isRunning = () => {
        return this.isProcessRunning && !this.childProcess.killed;
    }
}

module.exports = {BaseChildProcessWrapper, ChildProcessWrapper};