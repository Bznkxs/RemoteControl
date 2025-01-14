// const {SimpleTerminal} = require("../simpleAnsiTerminal/simple_terminal.js");
// const AnsiParser = require('node-ansiparser');

// ESM style:
import {SimpleTerminal} from "../simpleAnsiTerminal/simple_terminal.js";
import AnsiParser from 'node-ansiparser';

export class TerminalInterface {
    constructor(...terminalArgs) {
        this.terminal = new SimpleTerminal(...terminalArgs);
        this.parser = new AnsiParser(this.terminal);
    }

    parseRawOutput(rawOutput) {
        this.parser.parse(rawOutput);
        const stream = this.terminal.streamOut();
        return {stream};
    }
}

// module.exports = {TerminalInterface};