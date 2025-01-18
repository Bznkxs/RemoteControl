import {TextClass} from "./text_class.js";


export class TerminalTextLogMessage {
    /**
     * @param {string} text
     * @param {Date?} time
     * @param {string|TextClass} textClass
     * @param isInput
     * @param password
     * @param ansiOutputStream
     * @param otherArgs
     */
    constructor({text, time = undefined, textClass = TextClass.CONTENT,
                    isInput = false, password = false, ansiOutputStream = null, otherArgs=undefined}) {
        this.otherArgs = otherArgs;
        console.log("[TerminalTextLogMessage] constructor:", text.slice(0, 100), textClass, isInput, password, ansiOutputStream, time);
        this.text = text;
        this.ansiOutputStream = ansiOutputStream;
        this.time = time;
        this.textClass = new TextClass(textClass);
        this.isInput = isInput || this.textClass.v === TextClass.INPUT.v;
        this.password = password;
    }

    /**
     * @param {string} text
     * @param {TextClass} textClass
     * @param isInput
     * @param password
     * @param args
     */
    static createMessageWithCurrentTime(text, textClass, isInput = false, password = false, args = {}) {
        if (this.allowedTextClasses.has(textClass.v)) {
            const ansiOutputStream = args? args.ansiOutputStream: undefined;
            args.ansiOutputStream = undefined;
            return new this({text, time: new Date(), textClass, isInput, password, ansiOutputStream, otherArgs: args});
        } else {
            throw new Error(`Text class ${textClass} is not allowed for this log`);
        }
    }

    static createOutputMessageWithCurrentTime({text, args}, ansiOutputStream, endStream) {
        console.log("[TerminalTextLogMessage] createOutputMessageWithCurrentTime:", text.slice(0, 100), args);
        const message =  new this({text: text, time: new Date(), textClass: TextClass.CONTENT, ansiOutputStream, isInput: false, password: false});
        message.args = args;
        if (args) {
            if (args.pwd && args.pwd.envelope) {
                args.pwd = args.pwd.getPwd();
            }
            console.log("[TerminalTextLogMessage] createOutputMessageWithCurrentTime: args", args);
            if (args.command.startsWith("ls")) {

                // parse arg to get if -l is used
                const argList = args.command.split(" ");
                let longListing = false;
                for (let i = 0; i < argList.length; i++) {
                    const arg = argList[i];
                    if (arg.startsWith('-') && arg.includes('l')) {
                        longListing = true;
                        break;
                    }
                }
                let lastOutputEndsWithSpace = true;
                let newOutputSequence = [];
                for (let i = 0; i < message.ansiOutputStream.outputSequence.length; i++) {
                    const output = message.ansiOutputStream.outputSequence[i];
                    if (typeof output.text === "string") {
                        let separator = /[\t\n]+| {4,}/;
                        if (longListing) separator = /\n+/;
                        const lines = output.text.split(separator);
                        output.actionArgs = [];
                        for (let j = 0; j < lines.length; j++) {
                            const line = lines[j];
                            let parts;
                            if (longListing) {
                                parts = line.split(/\s+/);
                            } else {
                                parts = [line];
                            }
                            let entry;
                            if (parts.length >= 9) {
                                const permissions = parts[0];
                                const owner = parts[2];
                                const group = parts[3];
                                const size = parts[4];
                                const date = parts.slice(5, 7);
                                const time = parts[7];
                                const name = parts.slice(8).join(" ");
                                const modified = date + ' ' + time; // new Date(date + " " + time);
                                entry = {
                                    permissions: permissions,
                                    owner: owner,
                                    group: group,
                                    size: size,
                                    modified: modified,
                                    name: name,
                                    pwd: args.pwd,
                                };
                                parts[8] = `<span class="file-name">${parts[8]}</span>`;

                            }
                            else {
                                const outputStartsWithSpace = line.trimStart().length !== line.length;
                                console.log(`[TerminalTextLogMessage] createOutputMessageWithCurrentTime: ${i} ${j} Judge`, parts, outputStartsWithSpace, lastOutputEndsWithSpace, newOutputSequence.length > 0);
                                if (parts.length < 3) {

                                    if (j === 0 && !outputStartsWithSpace && !lastOutputEndsWithSpace && newOutputSequence.length > 0) {
                                        // merge with the previous line
                                        let lastOutput = newOutputSequence.pop();
                                        const lastEntry = lastOutput.actionArgs[0];
                                        lastOutput.text = lastOutput.text.replace("</span>\n", parts[0] + "</span>\n");
                                        lastEntry.name += parts[0];
                                        newOutputSequence.push(lastOutput);
                                        console.log(`[TerminalTextLogMessage] createOutputMessageWithCurrentTime: ${i} ${j} Update file-entry`, lastOutput.text);
                                        parts = parts.slice(1);
                                    }

                                }
                                if (parts.length === 0) {
                                    continue;
                                }
                                entry = {
                                    name:  parts.join(" ") ,
                                    pwd: args.pwd
                                };
                                parts = [ "<span class=\"file-name\">" + parts.join(" ") + "</span>\n"];
                            }
                            const newOutput = {
                                text: parts.join(" "),
                                elementClass: output.actionClass,
                                elementStyle: output.elementStyle,
                                actionClass: "file-entry",
                                actionArgs: [entry]
                            };
                            newOutputSequence.push(newOutput);
                            console.log(`[TerminalTextLogMessage] createOutputMessageWithCurrentTime: file-entry`, JSON.stringify(line), parts.join(" "));
                            lastOutputEndsWithSpace = line.trimEnd().length !== line.length;
                        }

                    }
                }
                message.ansiOutputStream.outputSequence = newOutputSequence;
            }
        }
        if (endStream && message.ansiOutputStream) {
            message.ansiOutputStream.outputSequence.push(...endStream.outputSequence);
            message.ansiOutputStream.endsWithNewline = endStream.endsWithNewline;
        }
        return message;
    }

    isLogSubclass(subclass) {
        return subclass.allowedTextClasses.has(this.textClass.v);
    }

    to(subclass) {
        if (this.isLogSubclass(subclass)) {
            return subclass.createMessageWithCurrentTime(this.text, this.textClass, false, false, {ansiOutputStream: null});
        } else {
            throw new Error(`Cannot convert log to subclass ${subclass}`);
        }
    }

    static get allowedTextClasses() {
        return new Set([
            TextClass.CONTENT.v,
            TextClass.INPUT.v,
            TextClass.COMMAND.v,
            TextClass.EXITCODE.v,
            TextClass.SIGNAL.v,
            TextClass.FILE.v
        ]);
    }

    static deserialize(serializedMessage) {
        if (serializedMessage.argList) {
            return new TerminalCommandLogMessage(serializedMessage);
        }
        return new TerminalTextLogMessage(serializedMessage);
    }

    serialize() {
        return {
            text: this.text,
            time: this.time,
            textClass: this.textClass.v,
            isInput: this.isInput,
            password: this.password,
            ansiOutputStream: this.ansiOutputStream,
            otherArgs: this.otherArgs
        };
    }
}

export class TerminalCommandLogMessage extends TerminalTextLogMessage {
    /**
     * @param {string} text
     * @param {Date} time
     * @param isInput
     * @param command
     * @param argList
     */
    constructor({text, time, isInput = true, argList=null, sftp=null}) {
        if (argList === null) {
            super({text, time, textClass: TextClass.COMMAND, isInput});
            let options;
            ({argList, options} = this.constructor.splitCommand(text));
            this.argList = argList;
            this.sftp = sftp === null ? options.sftp : sftp;
        } else {
            if (text === undefined) {
                text = argList.join(" ");
            }
            super({text, time, textClass: TextClass.COMMAND, isInput});
            this.argList = argList;
            this.sftp = sftp;
        }
    }

    serialize() {
        return {
            text: this.text,
            time: this.time,
            textClass: this.textClass.v,
            isInput: this.isInput,
            argList: this.argList,
            sftp: this.sftp
        };
    }

    static createTimedCommandMessage(text, isInput = true) {
        return new TerminalCommandLogMessage({text, time: new Date(), isInput});
    }

    static get allowedTextClasses() {
        return new Set([TextClass.COMMAND.v]);
    }

    /**
     * Split text into command and arguments. Here, the literals are kept as they are.
     * For example, "echo 'hello world\\''" will be split into ["echo", "'hello world\\''"].
     * Only the white spaces will be processed. For example,
     * "echo 'hello \
     * world'" will be split into ["echo", "'hello world'"].
     * @param text
     */
    static splitCommand(text) {
        // pair quotes
        let sftp = false;
        let inQuote = false;
        let lastQuote = null;
        const tokens = [];
        let token = "";
        let buffer = "";
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (i === 0 && char === "!") {
                sftp = true;
                continue;
            }
            let addToken = true;
            /*
              The chars are added to the latest token in the following way:
                - Tokens that are empty are not added
                - Judge based on the current char and buffer whether to add the current token
                - If the current token needs to be added, then add the buffer as well
                - The buffer may be modified
              The rules are as follows, the priority from top to bottom:
                - If a backslash in the buffer precedes a newline, then the newline is ignored; but these two chars are added as a new token to preserve the format
                - If a backslash in the buffer precedes a backslash, then both chars are added to the token
                - If a backslash in the buffer precedes a quote char, then both chars are added to the token
                - Any char in a quote is added to the token.
                   A quote is enclosed by a pair of the same quote char not preceded by a backslash, including the quotes.
                - Any whitespace not in a quote is a token separator
                - Any char not in a quote is added to the token
             */
            if (/\s+/.test(char)) {  // whitespace
                if (char === "\n" && buffer === "\\") {  // newline preceded by backslash: ignore both
                    buffer = "";
                    addToken = false;
                } else {  // whitespace as separator
                    if (!inQuote) {
                        if (token) {  // add token if not empty
                            tokens.push(token);
                        }
                        token = "";
                        addToken = false;
                    }
                }
            } else if (char === "\"" || char === "'") {  // quote
                if (buffer === "\\") {  // escaped quote: treat normally
                } else {  // quote not escaped: toggle inQuote and add to token
                    if (inQuote) {  // end quote
                        if (lastQuote === char) {
                            inQuote = false;
                        }
                    } else {  // start quote: mark the last quote
                        inQuote = true;
                        lastQuote = char;
                    }
                }

            } else if (char === "\\") {  // backslash
                if (buffer !== "\\") {  // backslash not escaped: add to buffer
                    buffer += char;
                    addToken = false;
                }  // backslash escaped: treat normally along with buffer
            }
            if (addToken) {
                token += buffer + char;
                buffer = "";
            }
        }
        if (buffer) {
            throw new Error(`Check the last character of the command \`${text}\`. It may be an incomplete escape sequence.`);
        }
        if (token) {
            tokens.push(token);
        }
        return {argList: tokens, options: {sftp: sftp}};
    }

    get command() {
        return this.argList[0];
    }

    get args() {
        return this.argList.slice(1);
    }

}