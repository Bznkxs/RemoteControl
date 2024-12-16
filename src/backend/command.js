const { spawn } = require('child_process');
const {ipcMain} = require( 'electron' );
const AnsiParser = require('node-ansiparser');
const AnsiTerminal = require('node-ansiterminal').AnsiTerminal;
const {SimpleTerminal} = require('../simpleAnsiTerminal/simple_terminal');

class Command {
    childProcess = null;
    sendToChild = null;
    constructor() {
        this.connectSignals();
        this.terminal = new SimpleTerminal(800, 25, 50);
        this.parser = new AnsiParser(this.terminal);
    }

    destroy() {
        this.disconnectSignals();
    }
    createChildProcess (event, command, args) {
        const originalEventReply = event.reply;
        event.reply = (channel, ...args) => {
            console.log(`Replying to ${channel}: ${args}`);
            originalEventReply(channel, ...args, new Date());
        }
        this.childProcess = spawn(command, args, {
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        this.sendToChild = (data) => {
            if (this.childProcess.stdin.writable) {
                console.log(`Sending to child: ${data}`);
                this.childProcess.stdin.write(`${data}\n`); // Send input to child's stdin
                event.reply("script-stdin", data.toString().trim());
            } else {
                console.error('Child process stdin is not writable');
                event.reply("script-stdin-error", "Child process stdin is not writable");
            }
        };
        this.childProcess.on("spawn", () => {
            event.reply("script-spawn", "Child process spawned");
        });
        this.childProcess.stdout.on('data', (data) => {
            console.log(`Received from child: ${data.toString().trim()}`);
            event.reply("script-stdout", data.toString().trim());
        });
        this.childProcess.stderr.on('data', (data) => {
            console.error(`Error from child: ${data.toString().trim()}`);
            event.reply("script-stderr", data.toString().trim());
        });
        // this.childProcess.on('close', (code) => {
        //     console.log(`Child process exited with code ${code}`);
        //     event.reply("script-close", code);
        // });
        this.childProcess.on('exit', (code) => {
            console.log(`Child process exited with code ${code}`);
            event.reply("script-close", code);
        });
        console.log("Command create child process")
    }

    processIsRunning () {
        return this.childProcess !== null && this.childProcess.kill(0) === true; // cross-platform trick to check if the process is running
    }

    processAcceptsInput () {
        return this.processIsRunning() && this.childProcess.stdin.writable && this.sendToChild !== null;
    }

    connectSignals () {
        console.log("Connecting signals");
        console.log("Before: run-script", ipcMain.listenerCount('run-script'));
        ipcMain.on('run-script', (event, command, arg) => {
            console.log("Running script: command", command, "args", arg)
            // if child process is not null and is running (not returned), then return an error
            if (this.processIsRunning()) {
                event.reply("backend-error", "A script is already running. Please stop the current script before running a new one.")
            }
            else {
                this.createChildProcess(event, command, arg);
            }
        });
        console.log("After: run-script", ipcMain.listenerCount('run-script'))

        ipcMain.on('stop-script', (event, arg) => {
            console.log("Stopping script")
            if (this.processIsRunning()) {
                try {
                    this.childProcess.kill(); // kill the child process
                    console.log("Script stopped")
                } catch (e) {
                    console.error("Error stopping script", e)
                    event.reply("script-close", "Error stopping script")
                }
            }
            else {
                console.log("No script is currently running.")
                event.reply("script-close", "No script is currently running.")
            }
            console.log("Stop script ended")
        });

        ipcMain.on('send-input', (event, arg) => {
            if (!this.processAcceptsInput()) {
                event.reply("backend-error", "No script is currently running.")
            }
            else {
                this.sendToChild(arg);
            }
        });
    }

    disconnectSignals () {
        ipcMain.removeAllListeners('run-script');
        ipcMain.removeAllListeners('stop-script');
        ipcMain.removeAllListeners('send-input');
    }
}

module.exports = {Command};
