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

    takesInput() {
        return true;
    }

    /**
     *
     * @returns {RegExp|string|null|function}
     */
    commandPrompt() {
        console.log("[Command] commandPrompt: default")
        return /^.*[>$#]\s*$/;
    };

    outputTransform(outputAccumulation) {
        return outputAccumulation.ansiOutputStream.plainText;

    }

    testCommandPrompt(outputAccumulation) {
        const prompt = this.commandPrompt();
        if (prompt === null) {
            return null;
        }
        const transformedOutput = this.outputTransform(outputAccumulation);
        console.log(`[Command] testCommandPrompt: \`${transformedOutput}\` against \`${prompt}\``)
        if (prompt instanceof RegExp) {
            const lines = transformedOutput.trimEnd().split('\n');
            const lastLine = lines.pop();
            const matches = lastLine.match(prompt);
            if (matches) {
                matches.index += (lines.length === 0 ? 0 : lines.join("\n").length + 1);
            }
            return matches;
        }
        if (prompt instanceof Function) {
            return prompt(transformedOutput);
        }
        if (prompt instanceof String) {
            const matches = transformedOutput.trimEnd().endsWith(prompt);
            if (matches) {
                return {index: transformedOutput.trimEnd().length - prompt.length};
            }
            return null;
        }

    }

    finish(output, event) {
        console.log(`[Command] finish: ${output}, ${event}`);
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
    context = {
        commandText: "",
        commandType: "",
        contextListeners: []
    }
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
    context = {
        commandText: "",
        commandType: "",
        contextListeners: []
    }
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
     * @param {function(text)} callback The callback is called when the defined command is realized: it sends the text to child process.
     * @param args
     */
    constructor(text, callback, ...args) {
        super(text, callback, false, ...args);
    }


    /**
     * For DefineCommand, the defaultCommand is a synthesized Command object. The text is what needs
     * to be realized; the callback sends the text to child process.
     * @returns {Command}
     */
    defaultCommand() {
        return new Command(this.args.join(" ") + this.eol, this.callback, undefined, ...this.otherArgs);
    }

    commandPrompt() {
        return null;
    }
}

/**
 * Create a command from a text string. Supports SFTP commands.
 * @param {string} text  If a .exe extension is found, it is removed. If the first word is "define", a DefineCommand is created.
 * @param {function?} callback For DefineCommand, the callback sends the text to child process. For other commands, the callback is called when the command is finished.
 * @param {boolean?} log  Ignored if DefineCommand is created.
 * @param {boolean?} inSFTP  Ignored if DefineCommand is created.
 * @param {object?} otherArgs
 * @returns {Command}
 */
export const createCommandFromText = (text, callback, log=undefined, inSFTP=undefined, ...otherArgs) => {
    const argList = Command.getArgList(text);
    if (argList.length === 0) {
        throw new Error(`[createCommandFromText] No command found in text: ${text}`);
    }
    if (argList[0].endsWith(".exe")) {
        argList[0] = argList[0].slice(0, -4);
    }
    if (argList[0] === "define") {
        return new DefineCommand(text, callback, ...otherArgs);
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
