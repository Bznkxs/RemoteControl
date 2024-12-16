import {TextClass} from "./text_class.js";

export class TerminalTextLogMessage {
    /**
     * @param {string} text
     * @param {Date} time
     * @param {string|TextClass} textClass
     * @param isInput
     * @param password
     * @param ansiOutputStream
     */
    constructor({text, time, textClass, isInput = false, password = false, ansiOutputStream = null}) {
        this.text = text;
        this.ansiOutputStream = ansiOutputStream;
        this.time = time;
        this.textClass = new TextClass(textClass);
        if (isInput || this.textClass.v === TextClass.INPUT.v) {
            this.isInput = true;
        }
        this.password = password;
    }

    /**
     * @param {string} text
     * @param {TextClass} textClass
     * @param isInput
     * @param password
     */
    static createMessageWithCurrentTime(text, textClass, isInput = false, password = false) {
        if (this.allowedTextClasses.has(textClass.v)) {
            return new this({text, time: new Date(), textClass, isInput, password});
        } else {
            throw new Error(`Text class ${textClass} is not allowed for this log`);
        }
    }

    isLogSubclass(subclass) {
        return subclass.allowedTextClasses.has(this.textClass.v);
    }

    to(subclass) {
        if (this.isLogSubclass(subclass)) {
            return subclass.createMessageWithCurrentTime(this.text, this.textClass);
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
            TextClass.SIGNAL.v
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
            ansiOutputStream: this.ansiOutputStream
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
    constructor({text, time, isInput = true, argList=null}) {
        if (argList === null) {
            super({text, time, textClass: TextClass.COMMAND, isInput});
            this.argList = this.constructor.splitCommand(text);
        } else {
            if (text === undefined) {
                text = argList.join(" ");
            }
            super({text, time, textClass: TextClass.COMMAND, isInput});
            this.argList = argList;
        }
    }

    serialize() {
        return {
            text: this.text,
            time: this.time,
            textClass: this.textClass.v,
            isInput: this.isInput,
            argList: this.argList
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
        let inQuote = false;
        let lastQuote = null;
        const tokens = [];
        let token = "";
        let buffer = "";
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
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
        return tokens;
    }

    get command() {
        return this.argList[0];
    }

    get args() {
        return this.argList.slice(1);
    }

}