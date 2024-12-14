const {SimpleTerminal} = require ("./simpleAnsiTerminal/simple_terminal");

const AnsiParser = require('node-ansiparser');
const AnsiTerminal = require('node-ansiterminal').AnsiTerminal;


const getAnsiTerminalInfo = (command, data) => {
    let terminal, parser;
    if (command.terminal) {
        terminal = command.terminal;
        parser = command.parser;
    } else {
        terminal = new AnsiTerminal(800, 25, 50);
        parser = new AnsiParser(terminal);
    }
    parser.parse(data);
    const buffer = [];
    terminal.screen.buffer.forEach((row) => {
        const rowBuffer = {cells: []};
        row.cells.forEach((cell) => {
            rowBuffer.cells.push({
                attr: cell.attr,
                gb: cell.gb,
                width: cell.width,
                c: cell.c
            });
        });
        buffer.push(rowBuffer);
    });
    return {
        buffer,
        cursor: terminal.cursor
    };
};


const terminalAndParsers = {}

const getTerminalAndParser = (name) => {
    if (terminalAndParsers[name]) {
        return terminalAndParsers[name];
    } else {
        const terminal = new SimpleTerminal(80, 30, 50);
        const parser = new AnsiParser(terminal);
        terminalAndParsers[name] = {terminal, parser};
        return terminalAndParsers[name];
    }
}
const getSimpleTerminalInfo = (data) => {
    let {name, rawOutput, continuousMessage=false, terminal, parser} = data;
    if (!terminal) {
        if (name) {
            const terminalAndParser = getTerminalAndParser(name);
            terminal = terminalAndParser.terminal;
            parser = terminalAndParser.parser;
            // console.log(name, terminal, parser)
        } else {
            terminal = new SimpleTerminal(80, 30, 50);
            parser = new AnsiParser(terminal);
        }
    }
    console.log(new Error, rawOutput)
    parser.parse(rawOutput);
    const stream = terminal.streamOut(continuousMessage);
    console.log("outputSequence", stream)
    return {
        stream: stream
    };
}


module.exports = {getAnsiTerminalInfo, getSimpleTerminalInfo};
