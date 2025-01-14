import fs from "fs";
import path from "path";
import os from "os";
import {ChildProcessOutput} from "./child_process_output.js";
import {BaseChildProcessWrapper, ChildProcessWrapper} from "./child_process_wrapper.js";
import {CorrespondingOutputManager, ListenForEndOfSessionCommand, OutputEvent} from "./corresponding_output_manager.js";
import {createCommandFromText, DefineCommand, SFTPCommand} from "./sftp_command.js";

export class SFTPWrapper extends BaseChildProcessWrapper {
    constructor(command, args, onSpawnedCallback, options={
        env: process.env,
        cwd: process.cwd(),
        cols: 80,
        rows: 30,
    }) {
        super();
        this.correspondingOutputManager = new CorrespondingOutputManager(
            (command) => {
                return this.sendProcessedCommand(command);
            } );
        if (command instanceof ChildProcessWrapper) {
            this.sftp = command;
            this.onDataListeners = this.sftp.onDataListeners;
            this.sftp.onDataListeners = [];
            this.onExitListeners = this.sftp.onExitListeners;
            this.sftp.onExitListeners = [];
        }
        else {

            this.sftp = new ChildProcessWrapper(command, args, onSpawnedCallback, options);
            const startingCommand = createCommandFromText(command, ()=>{}, true, false,{command: command, startingCommand: true});

            this.correspondingOutputManager.addCommand(startingCommand); // add starting command to maintain context
            this.onDataListeners = [];
            this.onExitListeners = [];
        }
        this.sftp.onStdout(this.defaultOnStdoutListener);
        this.sftp.onExit(this.defaultOnExitListener);

        this.createLocalTmpFolder();

        this.remote_pwd = null;

    }



    destroy() {
        if (this.tmpDir) {
            fs.rmdir(this.tmpDir, {recursive: true}, (err) => {
                if (err) {
                    console.error("Error deleting tmp folder", err);
                }
            });
        }
        this.onDataListeners = [];
        this.onExitListeners = [];
        this.sftp = null;
    }

    destroyAndReturnChildProcessWrapper = () => {
        const sftp = this.sftp;
        sftp.onDataListeners = this.onDataListeners;
        sftp.onExitListeners = this.onExitListeners;

        this.destroy();
        return sftp;
    }

    defaultOnExitListener = (e) => {
        this.destroy();
        this.onExitListeners.forEach((listener) => {
            listener(e);
        });
    }

    isRunning = () => {
        return this.sftp.isRunning();
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
     *
     * @param command
     * @returns
     */
    addCommandToBuffer = (command) => {
        return this.correspondingOutputManager.addCommandFromText(command);
    }




    createDefaultCommand = (command, callback=null, log=true, inSFTPContext=undefined, otherArgs=undefined) => {
        let commandText = command;
        if (typeof command.text === "string") {
            commandText = command.text;
        }
        if (!callback) callback = () => {};
        if (inSFTPContext === undefined) inSFTPContext = this.correspondingOutputManager.inSFTPContext();
        if (otherArgs === undefined) otherArgs = {command: commandText, pwd: {envelope: true, getPwd: () => this.remote_pwd}};
        console.log("[SFTPWrapper] Creating default command", commandText, callback, log, inSFTPContext, otherArgs)
        return createCommandFromText(commandText, callback, log, inSFTPContext, otherArgs);
    }

    createDefaultCommandList = (command, callback=null, log=true, inSFTPContext=undefined, otherArgs=undefined) => {
        return [this.createDefaultCommand(command, callback, log, inSFTPContext, otherArgs)];
    }

    getPwd = (eol, callback=null) => {
        return this.pwd(eol, callback, false, (pwd) => {
            if (pwd === null) {
                console.error("Error getting pwd");
            } else {
                this.remote_pwd = pwd;
            }
        })[0];
    }


    cd = (command, callback, log) => {
        const cdCommand = this.createDefaultCommand(command, callback, log);
        const pwdCommand = this.getPwd(command.eol);
        return [cdCommand, pwdCommand];
    }

    ls = (command, callback, log) => {
        const pwdCommand = this.getPwd(command.eol);
        const lsCommand = this.createDefaultCommand(command, callback, log);
        return [pwdCommand, lsCommand];
    }

    normalizeLocalPath = (localPath) => {
        if (this.correspondingOutputManager.getBottomContext("ubuntu") ||
            this.correspondingOutputManager.getBottomContext("wsl")  || localPath.match(":") !== null) {
            const driveLetter = localPath[0];
            localPath = localPath.slice(2).split("\\");
            localPath = path.posix.join("/mnt", driveLetter.toLowerCase(), ...localPath);
        }
        return localPath;
    }

    get = (command, callback, log) => {
        const localPath = this.normalizeLocalPath(command.args[1]);
        return this.createDefaultCommandList(`get ${command.args[0]} "${localPath}"` + command.eol, callback, log);
    }

    put = (command, callback, log) => {
        const localPath = this.normalizeLocalPath(command.args[0]);
        return this.createDefaultCommandList(`put "${localPath}" ${command.args[1]}` + command.eol, callback, log);
    }


    pwd = (eol, callback, log, pwdCallback) => {
        return this.createDefaultCommandList(`pwd` + eol, (output, event) => {

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

    sendToChild = (data) => {
        this.addCommandToBuffer("define " + data);
    }


    sendProcessedCommand1 = (command) => {
        console.log(`[SFTPWrapper] SFTPContext: ${this.correspondingOutputManager.inSFTPContext()}, Sending processed command`, command)
        if (command.otherArgs && command.otherArgs[0] && command.otherArgs[0].startingCommand) return;
        if (command instanceof DefineCommand) {
            command = command.defaultCommand();
            if (this.correspondingOutputManager.inSFTPContext()) {

                switch (command.command) {
                    case "cd":
                        return this.cd(command);
                    case "ls":
                        return this.ls(command);
                    case "get":
                        return this.get(command);
                    case "put":
                        return this.put(command);
                    case "pwd":
                        return this.pwd(command.eol);
                    case "!open":
                        return this.open(command);

                    default:
                        return this.createDefaultCommandList(command);
                }
            }
            else {
                return this.createDefaultCommandList(command);
            }

        }
        if (!(command instanceof ListenForEndOfSessionCommand)) {
            this.sftp.sendToChild(command.text);
        }

    }

    sendProcessedCommand = (command) => {
        const commands = this.sendProcessedCommand1(command);
        console.log("[SFTPWrapper] Sending processed command", commands);
        return commands;
    }



    onStdout = (callback) => {
        this.onDataListeners.push(callback);
    }

    onStderr = (callback) => {
        console.warn("[SFTPWrapper] Warning: Stderr is not supported in node-pty")
    }

    onExit = (callback) => {
        this.onExitListeners.push(callback);
    }

    /**
     *
     * @param {ChildProcessOutput} childProcessOutput
     */
    emitData = (childProcessOutput) => {
        console.log("[SFTPWrapper] Emit data", childProcessOutput);
        this.onDataListeners.forEach((listener) => {
            listener(childProcessOutput);
        });
    }

    /**
     *
     * @param {ChildProcessOutput} data
     */
    defaultOnStdoutListener = (data) => {
        console.log("[SFTPWrapper] Received data", JSON.stringify(data));
        this.correspondingOutputManager.handleOutput(new OutputEvent(data.text), (correspondence) => {
            if (correspondence.command && !correspondence.command.log) return;
            this.emitData(new ChildProcessOutput(correspondence.output, correspondence.end,
                correspondence.command ? correspondence.command.otherArgs[0] : null));
        });
    }
}