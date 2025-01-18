import * as commands from "./sftp_command.js" ;
import {createCommandFromText, DefineCommand, ExitContextCommand} from "./sftp_command.js";

export class Correspondence {
    constructor(output, end, command) {
        this.output = output;
        this.end = end;
        this.command = command;
    }
}



export class ListenForEndOfSessionCommand extends commands.ExitContextCommand {
    constructor() {
        super("ListenForEndOfSessionCommand", null, true);
    }

    isEndOfSession(output) {
        const lastLine = output.trimEnd().split("\n").pop();
        return lastLine.indexOf("logout") > -1 || lastLine.indexOf("Connection closed") > -1;
    }
    commandPrompt() {
        return "\n";
    }

    finish(output, event) {
        if (this.isEndOfSession(output)) {
            this.exitContextCallback(this.contextStack[this.contextStack.length - 1]);
        }
    }
}

/**
 * The first command in the buffer is the current command. It is always running.
 */
export class CommandBuffer {
    constructor(executeCurrentCommandInBufferCallback, options) {
        this.commandBuffer = [];
        this.executeCurrentCommandInBufferCallback = executeCurrentCommandInBufferCallback;
        this.ends = false;
        this.defaultCommand = options.defaultCommand;
    }

    /**
     * Internal function to execute the current (head) command in the buffer.
     */
    executeCurrentCommandInBuffer() {
        this.executeCurrentCommandInBufferCallback(this.currentCommand());
    }


    /**
     * Push a command to the tail of the buffer queue. If the buffer is empty, execute the command immediately.
     * @param command
     */
    push(command) {
        console.log("[CommandBuffer] push", JSON.stringify(command));
        const length = this.commandBuffer.length;
        this.commandBuffer.push(command);
        if (length === 0) {
            console.log("[CommandBuffer] push.executeCurrent", JSON.stringify(command));
            this.executeCurrentCommandInBuffer();
        }
    }

    /**
     * Return the current (head) command in the buffer queue.
     * @returns {*}
     */
    currentCommand() {
        return this.commandBuffer[0] || this.defaultCommand;
    }

    /**
     * Substitute the current (head) command with a list of commands. The first command in the list will be executed
     * @param commandList
     */
    substituteCurrentCommand(commandList) {
        if (this.commandBuffer.length === 0) {
            commandList.forEach((command) => this.push(command));
        } else {
            this.commandBuffer.splice(1, 0, ...commandList);
            this.shift();
        }
    }

    shift() {
        const ret = this.commandBuffer.shift();
        if (this.commandBuffer.length > 0)
            this.executeCurrentCommandInBuffer(this.commandBuffer[0]);
        return ret;
    }

    length() {
        return this.commandBuffer.length;
    }

}

/**
 *
 */
export class OutputEvent {
    /**
     * A wrapper for formatted ansi output. Takes in two argument, the raw text, and ansi output stream.
     * Use .text to access the raw text and .ansiOutputStream to access the ansi output stream.
     * @param {string} text
     * @param {AnsiOutputStream?} ansiOutputStream
     */
    constructor(text, ansiOutputStream) {
        this.text = text;
        this.ansiOutputStream = ansiOutputStream;
        this.identifier = OutputEvent.generateIdentifier();
    }

    static identifiers = [];

    /**
     * Generate a unique identifier for the output event.
     * @returns {string}
     */
    static generateIdentifier() {
        const identifier = `OutputEvent${OutputEvent.identifiers.length}`;
        this.identifiers.push(identifier);
        return identifier;
    }
}

export class CorrespondingOutputManager {

    /**
     *
     * @param {Command} command
     */
    executeCommand = (command) => {
        throw new Error("executeCommand is not implemented")
    }

    /**
     *
     * @param {function(Command)} executeCommand
     */
    constructor(executeCommand) {
        this.listenForEndOfSessionCommand = new ListenForEndOfSessionCommand();
        this.executeCommand = executeCommand || this.executeCommand;
        this.commandBuffer = new CommandBuffer(
            (command) => this.executeCommandCommon(command),
            {defaultCommand: this.listenForEndOfSessionCommand});
        this.accumulation = "";  // the output buffer for the current command
        this.getAccumulation = () => this.accumulation;
        this.setAccumulation = (accumulation) => this.accumulation = accumulation;

        /**
         *
         * @type {{commandText: string, commandType: string}[]}
         */
        this.contextStack = [];  // When length = 2, the top context is the sftp context. When length = 1, the top context is the entry context.

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


    executeCommandCommon(bufferCommand) {
        console.log("[CorrespondingOutputManager] executeCommandCommon", JSON.stringify(bufferCommand));
        if (bufferCommand instanceof DefineCommand) {
            const commandList = this.executeCommand(bufferCommand);
            console.log("[CorrespondingOutputManager] executeCommandCommon", JSON.stringify(commandList));
            this.commandBuffer.substituteCurrentCommand(commandList);
        } else {
            this.setAccumulation("");
            // deal with context
            if (bufferCommand instanceof commands.CreateContextCommand) {
                bufferCommand.context.contextListeners.push((context) => this.createContextCallback(context));
            } else if (bufferCommand instanceof commands.ExitContextCommand) {
                bufferCommand.context.contextListeners.push((context) => this.exitContextCallback(context));
            }
            this.executeCommand(bufferCommand);
        }
    }

    /**
     *
     * @param {OutputEvent} event
     * @param {function(Correspondence)} outputListener
     */
    handleOutput = (event, outputListener) => {
        const accumulation = this.getAccumulation() + event.output;
        this.setAccumulation(accumulation);
        const command = this.commandBuffer.currentCommand();

        const {output, end} = (this.identifyCorrespondingOutput(accumulation, command));
        if (output !== undefined) {
            // that's all
            if (end && end.length <= event.output.length)
                this.sendOutput(event.output.slice(0, event.output.length - end.length), end, outputListener);
            else
                this.sendOutput('', event.output, outputListener);
            command.finish(output, event); // command finish callback
            this.commandBuffer.shift();
            this.setAccumulation("");
        } else {
            this.sendOutput(event.output, '', outputListener);
        }
    }

    /**
     *
     * @param {string} output
     * @param {string} end
     * @param {function(Correspondence)} outputListener
     * @param {boolean} createCorrespondence
     */
    sendOutput = (output, end, outputListener, createCorrespondence=true) => {
        console.log("[CorrespondingOutputManager] sendOutput", JSON.stringify(output), JSON.stringify(end), createCorrespondence, this.commandBuffer.currentCommand());
        const correspondence = new Correspondence(output, end, createCorrespondence ? this.commandBuffer.currentCommand(): null);
        outputListener(correspondence);
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
                return {output: accumulation, end: ''};
            }
            if (indicator instanceof RegExp) {
                const lines = accumulation.trimEnd().split('\n');
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
                    matches.index = accumulation.length - indicator.length;
                }
            } else {
                throw new Error("Unknown commandPrompt type");
            }
            console.log("[CorrespondingOutputManager] identifyCorrespondingOutput", command.commandPrompt(), JSON.stringify(accumulation.trimEnd()));

            if (matches) {
                const output = accumulation.substring(0, matches.index);
                const end = accumulation.substring(matches.index);
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

    addCommandFromText(text, callback, log, args) {
        const command = createCommandFromText(text, callback, log, this.inSFTPContext(), args);
        this.addCommand(command);
    }

    addCommand(command) {
        this.commandBuffer.push(command);
    }

}
