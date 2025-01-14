import {AutomatonSugar} from "./automaton.js";
import {dataContains} from "./text_processing.js";
import {TextClass} from "../../shared/text_class.js";
import {TerminalCommandLogMessage, TerminalTextLogMessage} from "../../shared/message.js";

class BaseRemoteControlContext {
    execute(command, ...args) {
        console.log("execute", command, args);
    }

    write(data) {
        console.log("write", data);
        return {
            onReply: (callback) => {
                console.log("onReply", callback);
            }
        }
    }

    onData(callback) {
        console.log("onData", callback);
    }

    readFile(filePath) {
        console.log("readFile", filePath);
    }
}

export
class RemoteControlContext extends BaseRemoteControlContext {
    constructor(callables) {
        super();
        console.log("RemoteControlContext constructor");
        this.callables = callables;
        this.writeInstances = [];
        this.onGettingActionInfo = callables.onGettingActionInfo || (() => {});
    }

    stopCommand() {
        console.log("stopCommand");
        this.callables.stopCommand();
    }

    onExit(callback) {
        console.log("onExit", callback);
        this.callables.onExit(callback);
    }

    execute(command) {
        // if (command instanceof String || typeof command === "string") {
        //     console.log("Command is a string");
        //     command = TerminalCommandLogMessage.createTimedCommandMessage(command, true);
        // }
        this.callables.execute(command);
    }

    write(data, {registerWriteInstance = true, password = false}={}) {
        console.log("WRITE!", data, registerWriteInstance, password)
        // if (data instanceof String || typeof data === "string") {
        //     console.log("Data is a string");
        //     data = TerminalTextLogMessage.createMessageWithCurrentTime(data, TextClass.INPUT, true, password);
        // }
        this.callables.write(data, {password: password});
        const writeInstance = {
            data: data
        };
        console.log(registerWriteInstance, password);
        // if (registerWriteInstance) {
        //     this.registerWriteInstance(writeInstance);
        //     return {
        //         writeInstance,
        //         onReply: (callback) => {
        //             writeInstance.callback = callback;
        //         }
        //     }
        // } else {
        // }
    }

    registerWriteInstance(writeInstance) {
        const values = [];
        for (const instance of this.writeInstances) {
            values.push(instance.value);
        }
        values.sort()
        let minimumValue = 0;
        for (const value of values) {
            if (value > minimumValue) {
                break;
            }
            minimumValue++;
        }
        writeInstance.value = minimumValue;
        this.writeInstances.push(writeInstance);
    }

    onData(callback) {
        this.callables.onData(callback);
        for (const writeInstance of this.writeInstances) {
            console.log("Const writeInstance", writeInstance);
            writeInstance.callback = callback;
        }
    }

    readFile(filePath) {
        return this.callables.readFile(filePath);
    }

    changeEOL(eol) {
        console.log("changeEOL", JSON.stringify(eol))
        this.callables.changeEOL(eol);
    }

    removeWriteInstance(writeInstance) {
        this.writeInstances = this.writeInstances.filter(instance => instance !== writeInstance);
    }

    stopListening() {
        this.callables.removeListeners();
    }



    createAutomaton() {
        const automaton = new AutomatonSugar();
        this.automaton = automaton;
        automaton.registerContext(this);
        automaton.registerActionPerformedListener((action) => {return this.onGettingActionInfo(action)});
        return automaton;
    }

    setPrompt(promptContains=/^.+[>$]\s*$/) {
        this.promptContains = promptContains;
    }

    extractOutput(data) {
        const output = [];
        const lines = data.split("\n");
        for (const line of lines) {
            if (!line) continue;
            if (dataContains(line, this.promptContains)) continue;
            output.push(line);
        }
        console.log("Extracted output", output);
        return output.join("\n");
    }

    dataContains(data, contains) {
        return dataContains(data, contains);
    }

    fakeEvent(channel, ...data) {
        for (const [c, listener] of this.callables.listeners) {
            if (c === channel) {
                listener(...data);
            }
        }
    }
}