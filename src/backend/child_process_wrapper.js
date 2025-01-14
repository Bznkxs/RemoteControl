// const pty = require('node-pty');
// const fs = require('fs');
// const os = require('os');
// const {ChildProcessOutput} = require("child_process_output.js");
// const path = require("path");


// ESM style:
import pty from 'node-pty';
import fs from 'fs';
import os from 'os';
import {ChildProcessOutput} from './child_process_output.js';
import path from 'path';


export class BaseChildProcessWrapper {
    constructor(...args) {
    }

    sendToChild = () => {}
    onStdout = () => {}
    onStderr = () => {}
    onExit = () => {}
    kill = () => {}
    isRunning = () => {}
}

export class ChildProcessWrapper extends BaseChildProcessWrapper {
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
        this.childProcess.onData(this.defaultOnDataListener);
        onSpawnedCallback();

        this.onDataListeners = [];
        this.onExitListeners = [];
        this.eol = "\r\n";
    }

    sendToChild = (data) => {
        if (this.isRunning()) {
            console.log("[ChildProcessWrapper] Sending data to child process", JSON.stringify(data))
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


    /**
     *
     * @param {function(ChildProcessOutput)} callback
     */
    onStdout = (callback) => {
        this.onDataListeners.push(callback);
    }

    defaultOnDataListener = (data) => {
        console.log("[ChildProcessWrapper] Received data from child process", JSON.stringify(data))
        this.onDataListeners.forEach((listener) => {
            listener(new ChildProcessOutput(data));
        });
    }

    onStderr = (callback) => {
        console.warn("[ChildProcessWrapper] Warning: Stderr is not supported in node-pty")
    }

    onExit = (callback) => {
        this.onExitListeners.push(callback);
    }

    defaultOnExitListener = (e) => {
        this.isProcessRunning = false;
        this.returnCode = e;
        console.log("[ChildProcessWrapper] Process exited with code", e);
        this.onExitListeners.forEach((listener) => {
            listener(e);
        });
    }

    isRunning = () => {
        return this.isProcessRunning && !this.childProcess.killed;
    }
}



//
// module.exports = {BaseChildProcessWrapper, ChildProcessWrapper, SFTPWrapper};