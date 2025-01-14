import {
    CommandBuffer,
    Correspondence,
    ListenForEndOfSessionCommand,
    OutputEvent
} from "./corresponding_output_manager.js";
import {createCommandFromText, DefineCommand} from "./sftp_command.js";
import path from "path";
import fs from "fs";
import {ChildProcessOutput} from "./child_process_output.js";
import * as commands from "./sftp_command.js";
import {AnsiOutputStream} from "../simpleAnsiTerminal/ansi_output_stream.js";

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
    }

    resetAccumulation() {
        this.accumulation = {
            rawText: "",
            ansiOutputStream: AnsiOutputStream.empty()
        };
    }

    getAccumulation() {
        return this.accumulation;
    }

    setAccumulation(accumulation) {
        this.accumulation = accumulation;
    }

    appendAccumulation(message) {
        this.accumulation.rawText += message.text;
        this.accumulation.ansiOutputStream = this.accumulation.ansiOutputStream.join(message.ansiOutputStream);
        return this.accumulation;
    }

    /**
     *
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
            if (!(command instanceof ListenForEndOfSessionCommand)) {
                if (command.otherArgs && command.otherArgs[0] && command.otherArgs[0].sendMessageCallback) {
                    command.otherArgs[0].sendMessageCallback(command.text);
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



    bufferInput(text, callback) {
        this.commandBuffer.push(createCommandFromText("define " + text, callback));
    }

    createDefaultCommand = (command, callback=null, log=true, inSFTPContext=undefined, otherArgs=undefined) => {
        let commandText = command;
        if (typeof command.text === "string") {
            commandText = command.text;
        }
        if (!callback) callback = () => {};
        if (inSFTPContext === undefined) inSFTPContext = this.inSFTPContext();
        if (otherArgs === undefined) otherArgs = {command: commandText, pwd: {envelope: true, getPwd: () => this.remote_pwd}};
        if (command.callback) {
            otherArgs.sendMessageCallback = command.callback;
        }
        console.log("[SFTPWrapper] Creating default command", commandText, callback, log, inSFTPContext, otherArgs)
        return createCommandFromText(commandText, callback, log, inSFTPContext, otherArgs);
    }

    createDefaultCommandList = (command, callback=null, log=true, inSFTPContext=undefined, otherArgs=undefined) => {
        return [this.createDefaultCommand(command, callback, log, inSFTPContext, otherArgs)];
    }

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


    pwd = (command, callback, log, pwdCallback) => {
        return this.createDefaultCommandList({text:
                `pwd` + command.eol, callback: command.callback},
            (output, event) => {

            const re = /^Remote working directory: (.*)$/gm;
            const match = re.exec(output);
            // console.log(match);
            if (match) {
                this.remote_pwd = match[1];
                console.log("[SFTPWrapper] Remote pwd", this.remote_pwd);
                pwdCallback && pwdCallback(this.remote_pwd);
            } else {
                console.error("[SFTPWrapper] Error parsing pwd output", JSON.stringify(output));
                pwdCallback && pwdCallback(null);
            }
            if (callback) callback(output, event);
        }, log);
    }


    open = (command, callback, log) => {
        let filename = command.args[0];
        let basename = path.basename(filename);
        let tempLocal = fs.mkdtempSync(path.join(this.tmpDir, 'open-'));
        let tempFilename = path.join(tempLocal, basename);
        return this.get({args: [filename, tempFilename], eol: command.eol}, (output, event) => {
            this.emitData(new ChildProcessOutput(`!${tempFilename}`, '',{command: "!open", localPath: tempFilename}));
            callback && callback(output, event);
        }, log);
    }

    identifyCorrespondingOutput(accumulation, command) {
        if (command instanceof ListenForEndOfSessionCommand) {
            return {output: undefined, end: undefined};
        } else {
            if (command instanceof commands.ExitContextCommand) {
                // commandPrompt should be normal command prompt of last context
            }
            const indicator = command.commandPrompt();
            let matches;
            if (indicator === null) {
                return {output: accumulation.ansiOutputStream, end: AnsiOutputStream.empty()};
            }
            if (indicator instanceof RegExp) {
                const lines = accumulation.ansiOutputStream.text.trimEnd().split('\n');
                const lastLine = lines.pop();
                matches = lastLine.match(indicator);
                if (matches) {
                    matches.index += (lines.length === 0 ? 0 : lines.join("\n").length + 1);
                }
            }
            else if (typeof indicator === "function") {
                matches = indicator(accumulation);
            } else if (typeof indicator === "string") {
                matches = accumulation.endsWith(indicator);
                if (matches) {
                    matches.index = accumulation.ansiOutputStream.text.length - indicator.length;
                }
            } else {
                throw new Error("Unknown commandPrompt type");
            }
            console.log("[CorrespondingOutputManager] identifyCorrespondingOutput", command.commandPrompt(), JSON.stringify(accumulation.trimEnd()));

            if (matches) {
                const [output, end] = accumulation.ansiOutputStream.splitByIndex(matches.index);
                console.log("[CorrespondingOutputManager] .identifyCorrespondingOutput", JSON.stringify(matches));
                console.log("[CorrespondingOutputManager] .identifyCorrespondingOutput", JSON.stringify(output), JSON.stringify(end));
                return {output, end};
            }
            else {
                console.log("[CorrespondingOutputManager] .identifyCorrespondingOutput no match");
                return {output: undefined, end: undefined};
            }
        }
    }

    /**
     *
     * @param {AnsiOutputStream} ansiOutputStream
     */
    receiveOutputFromChildProcess(ansiOutputStream) {
        console.log("[SFTPWrapper] Received data", JSON.stringify(ansiOutputStream));
        const event = new OutputEvent(ansiOutputStream);
        const accumulation = this.appendAccumulation(ansiOutputStream);
        const command = this.commandBuffer.currentCommand();

        const {output, end} = (this.identifyCorrespondingOutput(accumulation, command));
        if (output !== undefined) {
            // that's all
            if (end && end.length <= ansiOutputStream.length)
                this.sendOutput(ansiOutputStream.slice(0, ansiOutputStream.length - end.length), end);
            else
                this.sendOutput(AnsiOutputStream.empty(), ansiOutputStream);
            command.finish(output, event); // command finish callback
            this.commandBuffer.shift();
            this.setAccumulation("");
        } else {
            this.sendOutput(ansiOutputStream);
        }
    }

    /**
     *
     * @param {AnsiOutputStream} output
     * @param {AnsiOutputStream?} end
     * @param {boolean} createCorrespondence
     */
    sendOutput = (output, end, createCorrespondence=true) => {
        console.log("[CorrespondingOutputManager] sendOutput", JSON.stringify(output), JSON.stringify(end), createCorrespondence, this.commandBuffer.currentCommand());
        const correspondence = new Correspondence(output, end, createCorrespondence ? this.commandBuffer.currentCommand(): null);
        if (correspondence.command && !correspondence.command.log) return;
        this.emitData(new ChildProcessOutput(correspondence.output, correspondence.end,
                correspondence.command ? correspondence.command.otherArgs[0] : null));
    }


    onStdout(callback) {
        this.stdoutCallback = callback;
    }

    emitData(childProcessOutput) {
        console.log(`[ContextManager] emitData`, childProcessOutput);
        if (this.stdoutCallback) {
            this.stdoutCallback(childProcessOutput);
        }
    }
}