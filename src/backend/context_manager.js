import {
    CommandBuffer,
    Correspondence,
    ListenForEndOfSessionCommand,
    OutputEvent
} from "./x_corresponding_output_manager.js";
import {createCommandFromText, DefineCommand} from "./sftp_command.js";
import path from "path";
import fs from "fs";
import {ChildProcessOutput} from "./child_process_output.js";
import * as commands from "./sftp_command.js";
import {AnsiOutputStream} from "../simpleAnsiTerminal/ansi_output_stream.js";
import os from "os";
import {TerminalTextLogMessage} from "../shared/message.js";

class Accumulation {
    constructor() {
        this.rawText = "";
        this.ansiOutputStream = AnsiOutputStream.empty();
    }

}

export class ContextManager {
    constructor() {
        /**
         *
         * @type {{commandText: string, commandType: string}[]}
         */
        this.contextStack = [];
        this.commandBuffer = new CommandBuffer((command)=>{this.executeCommandCommon(command)},
            {defaultCommand: new ListenForEndOfSessionCommand()});
        this.remote_pwd = null;
        this.resetAccumulation();
        this.createLocalTmpFolder();
    }



    /**
     * Reset the accumulation buffer.
     */
    resetAccumulation() {
        this.accumulation = new Accumulation();
    }

    getAccumulation() {
        return this.accumulation;
    }

    setAccumulation(accumulation) {
        this.accumulation = accumulation;
    }

    /**
     * Append the latest output event to the accumulation buffer.
     * This includes appending the delta raw text and ansi output stream.
     * @param {OutputEvent} event
     * @returns {Accumulation}
     */
    appendAccumulation(event) {
        this.accumulation.rawText += event.text;
        this.accumulation.ansiOutputStream = this.accumulation.ansiOutputStream.join(event.ansiOutputStream);
        console.log("[ContextManager] appendAccumulation", JSON.stringify(this.accumulation));
        return this.accumulation;
    }

    /**
     * Generate a list of commands based on the current define command and context.
     * If in SFTP context, generate a list of SFTP commands.
     * @param {DefineCommand} command
     * @returns {[DefineCommand|lsCommand|cdCommand|getCommand|putCommand|rmCommand|mkdirCommand|rmdirCommand|renameCommand|pwdCommand|exitCommand|quitCommand|helpCommand|questionCommand|byeCommand|chmodCommand|chownCommand|chgrpCommand|lnCommand|SFTPCommand|sftpCommand|Command,*]|[*,DefineCommand|lsCommand|cdCommand|getCommand|putCommand|rmCommand|mkdirCommand|rmdirCommand|renameCommand|pwdCommand|exitCommand|quitCommand|helpCommand|questionCommand|byeCommand|chmodCommand|chownCommand|chgrpCommand|lnCommand|SFTPCommand|sftpCommand|Command]|[DefineCommand|lsCommand|cdCommand|getCommand|putCommand|rmCommand|mkdirCommand|rmdirCommand|renameCommand|pwdCommand|exitCommand|quitCommand|helpCommand|questionCommand|byeCommand|chmodCommand|chownCommand|chgrpCommand|lnCommand|SFTPCommand|sftpCommand|Command]}
     */
    generateCommandList = (command) => {
        const defaultCommand = command.defaultCommand();
        if (this.inSFTPContext()) {
            switch (defaultCommand.command) {
                case "cd":
                    return this.cd(defaultCommand);
                case "ls":
                    return this.ls(defaultCommand);
                case "get":
                    return this.get(defaultCommand);
                case "put":
                    return this.put(defaultCommand);
                case "pwd":
                    return this.pwd(defaultCommand);
                case "!open":
                    return this.open(defaultCommand);
                default:
                    return this.createDefaultCommandList(defaultCommand);
            }
        }
        else {
            return this.createDefaultCommandList(defaultCommand);
        }
    }

    /**
     * The common code for executing a command. The command is realized (substituted with a list of real commands)
     * if it is a DefineCommand, or the command is sent to the child process if it is not a DefineCommand.
     * @param {Command} command
     */
    executeCommandCommon(command) {
        console.log(`[ContextManager] SFTPContext: ${this.inSFTPContext()}, Executing command`, command)
        if (command instanceof DefineCommand) {
            const commandList = this.generateCommandList(command);
            console.log(`[ContextManager] generating commandList`, commandList);
            this.commandBuffer.substituteCurrentCommand(commandList);
        }
        else {
            this.resetAccumulation();
            if (command instanceof commands.CreateContextCommand) {
                command.context.contextListeners.push((context) => this.createContextCallback(context));
            } else if (command instanceof commands.ExitContextCommand) {
                command.context.contextListeners.push((context) => this.exitContextCallback(context));
            }
            if (!(command instanceof ListenForEndOfSessionCommand)) {  // don't send the command to the child process if it's a ListenForEndOfSessionCommand
                if (command.otherArgs && command.otherArgs[0] && command.otherArgs[0].sendMessageCallback) {  // if the command has a callback, use it to send the input message to the child process
                    command.otherArgs[0].sendMessageCallback(command.text, undefined);
                }
            }
        }
    }

    getCurrentContext() {
        return this.contextStack[this.contextStack.length - 1];
    }

    getBottomContext(matches=undefined) {
        if (matches === undefined) {
            return this.contextStack[0];
        } else {
            if (this.contextStack.length === 0) {
                return false;
            }
            return this.contextStack[0].commandType === matches;
        }

    }

    inSFTPContext() {
        return this.getCurrentContext() !== undefined && this.getCurrentContext().commandType === "sftp";
    }

    exitContextCallback() {
        this.contextStack.pop();
    }

    createContextCallback(context) {
        this.contextStack.push(context);
    }


    /**
     * Buffer the user input
     * @param text
     * @param {function(string)?} callback The method to send the input to the child process
     */
    bufferInput(text, callback) {
        console.log("[ContextManager] Buffering input", text);
        if (this.commandBuffer.length() > 0 && this.commandBuffer.currentCommand().takesInput()) {
            // this is seen as input of the current command. Send it directly.
            callback(text);
            return;
        }
        // generate a command
        this.commandBuffer.push(createCommandFromText("define " + text, callback,
            false, this.inSFTPContext()));
    }


    /**
     * The default command creator. Calls createCommandFromText internally.
     * @param {DefineCommand} command
     * @param {function(AnsiOutputStream?, OutputEvent?)?} callback The callback to call after the command is executed. The accumulated output and the last output event will be passed as arguments.
     * @param {boolean?} log
     * @param {boolean?} inSFTPContext
     * @param {object?} otherArgs: additional arguments to pass to the command. command and pwd are passed by default.
     * @returns {DefineCommand|lsCommand|cdCommand|getCommand|putCommand|rmCommand|mkdirCommand|rmdirCommand|renameCommand|pwdCommand|exitCommand|quitCommand|helpCommand|questionCommand|byeCommand|chmodCommand|chownCommand|chgrpCommand|lnCommand|SFTPCommand|sftpCommand|Command}
     */
    createDefaultCommand = (command, callback=null, log=true, inSFTPContext=undefined, otherArgs=undefined) => {
        let commandText = command.text;
        if (!callback) callback = () => {};
        if (inSFTPContext === undefined) inSFTPContext = this.inSFTPContext();
        if (otherArgs === undefined) otherArgs = {command: commandText, pwd: {envelope: true, getPwd: () => this.remote_pwd}};
        if (command.callback) {  // if the command has a callback, use it to send the input message to the child process
            otherArgs.sendMessageCallback = command.callback;
        }
        console.log("[ContextManager] Creating default command", commandText, callback, log, inSFTPContext, otherArgs)
        return createCommandFromText(commandText, callback, log, inSFTPContext, otherArgs);
    }

    /**
     * A helper function to create a list of commands from a single command. Calls createDefaultCommand internally.
     * @param command
     * @param {function(AnsiOutputStream?, OutputEvent?)?} callback
     * @param log
     * @param inSFTPContext
     * @param otherArgs
     * @returns {[(DefineCommand|lsCommand|cdCommand|getCommand|putCommand|rmCommand|mkdirCommand|rmdirCommand|renameCommand|pwdCommand|exitCommand|quitCommand|helpCommand|questionCommand|byeCommand|chmodCommand|chownCommand|chgrpCommand|lnCommand|SFTPCommand|sftpCommand|Command)]}
     */
    createDefaultCommandList = (command, callback=null, log=true, inSFTPContext=undefined, otherArgs=undefined) => {
        return [this.createDefaultCommand(command, callback, log, inSFTPContext, otherArgs)];
    }

    /**
     * Get the current working directory of the remote server. Updates the remote_pwd member variable.
     * @param {Command} command  This is needed to get the eol character. TODO: simplify this.
     * @param {function?} callback
     * @returns {DefineCommand|lsCommand|cdCommand|getCommand|putCommand|rmCommand|mkdirCommand|rmdirCommand|renameCommand|pwdCommand|exitCommand|quitCommand|helpCommand|questionCommand|byeCommand|chmodCommand|chownCommand|chgrpCommand|lnCommand|SFTPCommand|sftpCommand|Command}
     */
    getPwd = (command, callback=null) => {
        return this.pwd(command, callback, false, (pwd) => {
            if (pwd === null) {
                console.error("Error getting pwd");
            } else {
                this.remote_pwd = pwd;
            }
        })[0];
    }


    cd = (command, callback, log) => {
        const cdCommand = this.createDefaultCommand(command, callback, log);
        const pwdCommand = this.getPwd(command);
        return [cdCommand, pwdCommand];
    }

    ls = (command, callback, log) => {
        const pwdCommand = this.getPwd(command);
        const lsCommand = this.createDefaultCommand(command, callback, log);
        return [pwdCommand, lsCommand];
    }

    normalizeLocalPath = (localPath) => {
        if (this.getBottomContext("ubuntu") ||
            this.getBottomContext("wsl")  || localPath.match(":") !== null) {
            const driveLetter = localPath[0];
            localPath = localPath.slice(2).split("\\");
            localPath = path.posix.join("/mnt", driveLetter.toLowerCase(), ...localPath);
        }
        return localPath;
    }

    get = (command, callback, log) => {
        const localPath = this.normalizeLocalPath(command.args[1]);
        return this.createDefaultCommandList({text: `get ${command.args[0]} "${localPath}"` + command.eol,
            callback: command.callback
    }, callback, log);
    }

    put = (command, callback, log) => {
        const localPath = this.normalizeLocalPath(command.args[0]);
        return this.createDefaultCommandList({text: `put "${localPath}" ${command.args[1]}` + command.eol,
            callback: command.callback
    }, callback, log);
    }

    /**
     * Create a list of commands to execute the pwd command. Extracts output result. Sets remote_pwd member variable.
     * @param {Command} command required to get the eol character and callback
     * @param {function(AnsiOutputStream, OutputEvent)?} callback The callback to call after the pwd command is executed
     * @param {boolean?} log
     * @param {function(string|null)?} pwdCallback The callback to call after the pwd command is executed, and the output is parsed. The pwd will be provided as arg if parsed successfully, otherwise null.
     * @returns {(DefineCommand|lsCommand|cdCommand|getCommand|putCommand|rmCommand|mkdirCommand|rmdirCommand|renameCommand|pwdCommand|exitCommand|quitCommand|helpCommand|questionCommand|byeCommand|chmodCommand|chownCommand|chgrpCommand|lnCommand|SFTPCommand|sftpCommand|Command)[]}
     */
    pwd = (command, callback, log, pwdCallback) => {
        return this.createDefaultCommandList({text:
                `pwd` + command.eol, callback: command.callback},
            (output, event) => {

                const re = /^Remote working directory: (.*)$/gm;
                const match = re.exec(output.plainText);
                // console.log(match);
                if (match) {
                    this.remote_pwd = match[1];
                    console.log("[ContextManager] Remote pwd", this.remote_pwd);
                    pwdCallback && pwdCallback(this.remote_pwd);
                } else {
                    console.error("[ContextManager] Error parsing pwd output", JSON.stringify(output));
                    pwdCallback && pwdCallback(null);
                }
                if (callback) callback(output, event);
            }, log);
    }

    createLocalTmpFolder = (callback) => {
        if (!this.createTmpFolderAttempt) {
            this.createTmpFolderAttempt = true;
            fs.mkdtemp(path.join(os.tmpdir() + 'sftp-'), (err, folder) => {
                if (err) {
                    this.createTmpFolderAttempt = false;
                    throw new Error("Error creating tmp folder");
                }
                this.tmpDir = folder;
                if (callback) callback(folder);
            });
        }
    }

    /**
     * Open a file in the local system. The file is downloaded from the remote server.
     * @param command The defaultCommand object. It contains the command information, and its .callback member is the callback to send the command input to the child process.
     * @param callback The callback to call after the command is executed. It is called with the output and event as arguments.
     * @param log
     * @returns {(DefineCommand|lsCommand|cdCommand|getCommand|putCommand|rmCommand|mkdirCommand|rmdirCommand|renameCommand|pwdCommand|exitCommand|quitCommand|helpCommand|questionCommand|byeCommand|chmodCommand|chownCommand|chgrpCommand|lnCommand|SFTPCommand|sftpCommand|Command)[]}
     */
    open = (command, callback, log) => {
        let filename = command.args[0];
        let basename = path.basename(filename);
        let tempLocal = fs.mkdtempSync(path.join(this.tmpDir, 'open-'));
        let tempFilename = path.join(tempLocal, basename);
        return this.get({args: [filename, tempFilename], eol: command.eol, callback: command.callback}, (output, event) => {
            this.emitData(new OutputEvent(`!${tempFilename}`),
                new ChildProcessOutput(`!${tempFilename}`, '',{command: "!open", localPath: tempFilename, remotePath: filename}));
            callback && callback(output, event);
        }, log);
    }

    /**
     * Called at every output update. Identify if the accumulation corresponds to
     * a command output (accumulation ends with specific indicator). If so,
     * split the accumulation into output and end, where end means the part after the corresponding output.
     * @param {Accumulation} accumulation
     * @param {Command} command
     * @returns {{output: AnsiOutputStream?, end: AnsiOutputStream?}}
     */
    identifyCorrespondingOutput(accumulation, command) {
        console.log("[ContextManager] identifyCorrespondingOutput", JSON.stringify(accumulation), command.text);
        if (command instanceof ListenForEndOfSessionCommand) {
            return {output: undefined, end: undefined};  // no output to identify and no command to pop
        } else {
            if (command instanceof commands.ExitContextCommand) {
                // commandPrompt should be normal command prompt of last context
            }
            console.log("[ContextManager] identifyCorrespondingOutput.commandPrompt", command.commandPrompt());
            let matches = command.testCommandPrompt(accumulation); // the indicator to identify the end of the output
            if (matches) {
                const [output, end] = accumulation.ansiOutputStream.splitByIndex(matches.index);
                console.log("[ContextManager] .identifyCorrespondingOutput", JSON.stringify(matches));
                console.log("[ContextManager] .identifyCorrespondingOutput", JSON.stringify(output.plainText), JSON.stringify(end.plainText));
                return {output, end};
            }
            else {
                console.log("[ContextManager] .identifyCorrespondingOutput no match");
                return {output: undefined, end: undefined};
            }
        }
    }

    /**
     * After the output is generated from the child process and ansi-parsed,
     * call this method of ContextManager to identify the output,
     * pair it with command, and perform other necessary operations.
     * TODO: work out a way to update previous output
     * @param {OutputEvent} event The parsed output which contains two members: text and ansiOutputStream
     */
    receiveOutputFromChildProcess(event) {
        console.log("[ContextManager] Received data", JSON.stringify(event));
        const accumulation = this.appendAccumulation(event);
        const command = this.commandBuffer.currentCommand();

        const {output, end} = (this.identifyCorrespondingOutput(accumulation, command));
        if (output !== undefined) {
            // We've generated all output for the current command. Send the correspondence, and pop this command.
            console.log("[ContextManager] Reached end of output for command", command.text);
            if (end && end.length <= event.ansiOutputStream.length)
                this.sendOutput(event, event.ansiOutputStream.slice(0, event.ansiOutputStream.length - end.length), end);
            else
                this.sendOutput(event, AnsiOutputStream.empty(), event.ansiOutputStream);
            command.finish(output, event); // command finish callback
            this.commandBuffer.shift();
            this.resetAccumulation();
        } else {
            // the output is not yet complete. Send the output to the frontend.
            this.sendOutput(event, event.ansiOutputStream);
        }
    }

    /**
     *
     * @param {OutputEvent} event
     * @param {AnsiOutputStream} output
     * @param {AnsiOutputStream?} end
     * @param {boolean} createCorrespondence
     */
    sendOutput = (event, output, end, createCorrespondence=true) => {
        console.log("[ContextManager] sendOutput", JSON.stringify(output?output.plainText: output),
            JSON.stringify(end?end.plainText: end), createCorrespondence, this.commandBuffer.currentCommand());
        const correspondence = new Correspondence(output, end, createCorrespondence ? this.commandBuffer.currentCommand(): null);
        if (correspondence.command && !correspondence.command.log) return;
        this.emitData(event, new ChildProcessOutput(correspondence.output, correspondence.end,
                correspondence.command ? correspondence.command.otherArgs[0] : null));
    }


    onStdout(callback) {
        this.stdoutCallback = callback;
    }

    /**
     *
     * @param {OutputEvent} event
     * @param {ChildProcessOutput} childProcessOutput
     */
    emitData(event, childProcessOutput) {
        const message = TerminalTextLogMessage.createOutputMessageWithCurrentTime(
            {text: event.text, args: childProcessOutput.args},
            (childProcessOutput.text instanceof AnsiOutputStream) ? childProcessOutput.text: null,
            (childProcessOutput.end instanceof AnsiOutputStream) ? childProcessOutput.end: null);
        console.log(`[ContextManager] emitData`, message);
        if (this.stdoutCallback) {
            this.stdoutCallback(message);
        }
    }
}