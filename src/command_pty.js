const pty = require('node-pty');
const {Command} = require ("./command");
const {getSimpleTerminalInfo} = require("./backend_terminal_parsing");
class CommandPTY extends Command {
    constructor() {
        super();
        console.log("CommandPTY constructor");
    }

    createChildProcess(event, command, args) {
        const originalEventReply = event.reply;
        event.reply = (channel, ...args) => {
            console.log(`Replying to ${channel}: ${args}`);
            originalEventReply(channel, ...args, new Date());
        }
        console.log("CommandPTY create child process", command, args)
        try {
            this.childProcess = pty.spawn(command, args, {
                env: process.env,
                cwd: process.cwd(),
                cols: 80,
                rows: 30,
            });
        }

        catch (e) {
            console.log(e);
            if (e.message.includes("File not found") && !command.endsWith(".exe")) {
                console.log(process.env);
            }
            event.reply("script-close", 1);
            return;
        }
        console.log("CommandPTY create child process")
        this.sendToChild = (data) => {
            console.log(`Sending to child: ${data}`);
            this.childProcess.write(`${data}`); // Send input to child's stdin
        };
        event.reply("script-spawn", "Child process spawned");  // already spawned

        this.childProcess.onData((data) => {
            console.log(`Received from child: ${data}`);
            console.log("GETSIMPLETERMINALFINO", data)
            const {stream: ansiOutputStream} = getSimpleTerminalInfo({
                rawOutput: data,
                terminal: this.terminal,
                parser: this.parser,
                continuousMessage: false
            })
            event.reply("script-stdout", {data, ansiOutputStream});
        });
        this.isProcessRunning = true;
        this.childProcess.onExit( (arg) => {
            console.log(`Child process exited with code`);
            console.log(arg);
            event.reply("script-close", arg.exitCode);
            this.isProcessRunning = false;
            console.log("On exit event ended")
        });
        console.log("Command pty create child process")
    }

    processIsRunning () {
        return this.childProcess !== null && this.isProcessRunning; // cross-platform trick to check if the process is running
    }

    processAcceptsInput () {
        return this.processIsRunning() && this.sendToChild !== null;
    }
}

module.exports = {CommandPTY};