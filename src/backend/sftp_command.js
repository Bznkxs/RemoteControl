import path from "path";
import fs from "fs";
import {ChildProcessOutput} from "./child_process_output.js";
import {ListenForEndOfSessionCommand} from "./corresponding_output_manager.js";

export class Command {
    /**
     *
     * @param text
     * @param {function(text, OutputEvent)} callback
     * @param log
     * @param args
     */
    constructor(text, callback, log, ...args) {
        this.text = text;
        this.eol = text.slice(text.trimEnd().length);
        this.argList = Command.getArgList(text);
        this.command = this.argList[0];
        this.args = this.argList.slice(1);
        this.callback = callback;
        this.otherArgs = args;
        this.log = log;
        this.defaultFinishFunction = (output, event) => {
            if (this.callback) this.callback(output, event);
        };
    }
    static getArgList(text) {
        console.log("[Command] getArgList: ", JSON.stringify(text))
        return text.trim().split(/\s+/);
    }
    commandPrompt() {
        console.log("[Command] commandPrompt: default")
        return (rawText) => {
            const lines = rawText.trimEnd().split(/[\n\r]/);
            let lastLine = lines.pop();
            while (lastLine === "") {
                lastLine = lines.pop();
            }
            let parts = lastLine.split(/\x1B\[\d*;?1H/g);
            let partAfterCarriageANSI = parts.pop();
            let indexBefore = (lines.length === 0 ? 0 : lines.join("\n").length + 1) + (lastLine.length - partAfterCarriageANSI.length);
            const matches = /.*[>$#](?=([\r\n]|$| \x1B]0;.*$))/gs.exec(partAfterCarriageANSI);
            if (matches) {
                matches.index += indexBefore;
            }
        return matches;
    }  };
    finish(output, event) {
        console.log(`[Command] finish: ${output.text}`);
        this.defaultFinishFunction(output, event);
    }


    /**
     *
     * @param executeFunction
     * @returns {Promise<{text, outputEvent}>}
     */
    async execute(executeFunction) {
        return new Promise((resolve, reject) => {
            this.defaultFinishFunction = (output, event) => {
                resolve({output, event});
                if (this.callback) this.callback(output, event);
            }
            executeFunction(this.text);
        });
    }
}

export class SFTPCommand extends Command {
    constructor(text, callback, ...args) {
        super(text, callback, ...args);
    }
    commandPrompt() {
        return /sftp>\s*((?=\x1B).*|$)/;
    }
}

export class lsCommand extends SFTPCommand {
}

export class cdCommand extends SFTPCommand {
}

export class getCommand extends SFTPCommand {
}

export class putCommand extends SFTPCommand {
}

export class rmCommand extends SFTPCommand {
}

export class mkdirCommand extends SFTPCommand {
}

export class rmdirCommand extends SFTPCommand {
}

export class renameCommand extends SFTPCommand {
}

export class pwdCommand extends SFTPCommand {
}

export class ContextCommand extends Command {
    constructor(text, callback, ...args) {
        super(text, callback, ...args);
        this.context = {
            commandText: text,
            commandType: this.command,
            contextListeners: []
        }
    }

    finish(output, event) {
        this.context.contextListeners.forEach((listener) => listener(this.context));
        super.finish(output, event);
    }
}

export class ExitContextCommand extends SFTPCommand {
    constructor(text, callback, ...args) {
        super(text, callback, ...args);
        this.context = {
            commandText: text,
            commandType: this.command,
            contextListeners: []
        }
    }

    commandPrompt() {
        return Command.prototype.commandPrompt();
    }

    finish(output, event) {
        this.context.contextListeners.forEach((listener) => listener(this.context));
        super.finish(output, event);
    }

}

export class exitCommand extends ExitContextCommand {
}

export class quitCommand extends ExitContextCommand {
}

export class helpCommand extends SFTPCommand {
}

export class questionCommand extends SFTPCommand {
}

export class byeCommand extends ExitContextCommand {
}

export class chmodCommand extends SFTPCommand {
}

export class chownCommand extends SFTPCommand {
}

export class chgrpCommand extends SFTPCommand {
}

export class lnCommand extends SFTPCommand {
}

export class CreateContextCommand extends ContextCommand {


}

export class sftpCommand extends CreateContextCommand {
    commandPrompt() {
        return /sftp>\s*((?=\x1B).*|$)/;
    }
}

export class DefineCommand extends Command {  // DefineCommand is a command that defines a sequence of commands
    /**
     *
     * @param text
     * @param {function(text)} callback
     * @param args
     */
    constructor(text, callback, ...args) {
        super(text, callback, false, ...args);
    }

    defaultCommand() {
        return new Command(this.args.join(" ") + this.eol, this.callback, undefined, ...this.otherArgs);
    }

    commandPrompt() {
        return null;
    }
}


export const createCommandFromText = (text, callback, log, inSFTP=true, ...otherArgs) => {
    const argList = Command.getArgList(text);
    if (argList.length === 0) {
        throw new Error(`[createCommandFromText] No command found in text: ${text}`);
    }
    if (argList[0].endsWith(".exe")) {
        argList[0] = argList[0].slice(0, -4);
    }
    if (argList[0] === "define") {
        return new DefineCommand(text, callback, log, ...otherArgs);
    }
    if (inSFTP) {
        switch (argList[0]) {
            case "ls":
                return new lsCommand(text, callback, log, ...otherArgs);
            case "cd":
                return new cdCommand(text, callback, log, ...otherArgs);
            case "get":
                return new getCommand(text, callback, log, ...otherArgs);
            case "put":
                return new putCommand(text, callback, log, ...otherArgs);
            case "rm":
                return new rmCommand(text, callback, log, ...otherArgs);
            case "mkdir":
                return new mkdirCommand(text, callback, log, ...otherArgs);
            case "rmdir":
                return new rmdirCommand(text, callback, log, ...otherArgs);
            case "rename":
                return new renameCommand(text, callback, log, ...otherArgs);
            case "pwd":
                return new pwdCommand(text, callback, log, ...otherArgs);
            case "exit":
                return new exitCommand(text, callback, log, ...otherArgs);
            case "quit":
                return new quitCommand(text, callback, log, ...otherArgs);
            case "help":
                return new helpCommand(text, callback, log, ...otherArgs);
            case "?":
                return new questionCommand(text, callback, log, ...otherArgs);
            case "bye":
                return new byeCommand(text, callback, log, ...otherArgs);
            case "chmod":
                return new chmodCommand(text, callback, log, ...otherArgs);
            case "chown":
                return new chownCommand(text, callback, log, ...otherArgs);
            case "chgrp":
                return new chgrpCommand(text, callback, log, ...otherArgs);
            case "ln":
                return new lnCommand(text, callback, log, ...otherArgs);
            default:
                return new SFTPCommand(text, callback, log, ...otherArgs);
        }
    } else {
        switch (argList[0]) {
            case "sftp":
                return new sftpCommand(text, callback, log, ...otherArgs);
            default:
                return new Command(text, callback, log, ...otherArgs);
        }
    }

}
