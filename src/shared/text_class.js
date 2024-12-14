export class TextClass {
    /**
     * @param {string | TextClass} textClass
     */
    constructor(textClass) {
        if (textClass instanceof TextClass) {
            this.textClassString = textClass.textClassString;
        } else {
            if (textClass instanceof String || typeof textClass === "string") {
                this.textClassString = textClass;
            } else {
                console.log(textClass);

                throw new Error("textClass must be a string or a TextClass object");
            }
        }
    }

    get v() {
        return this.textClassString;
    }

    static get INPUT() {
        return new TextClass("input");
    }

    static get COMMAND() {
        return new TextClass("command");
    }

    static get SIGNAL() {
        return new TextClass("signal");
    }

    static get CONTENT() {
        return new TextClass("content");
    }

    static get EXITCODE() {
        return new TextClass("exit-code");
    }



    valueOf() {
        return this.textClassString;
    }

    isInput() {
        return this.textClassString === TextClass.INPUT.v;
    }

    isCommand() {
        return this.textClassString === TextClass.COMMAND.v;
    }

    isSignal() {
        return this.textClassString === TextClass.SIGNAL.v;
    }

    isContent() {
        return this.textClassString === TextClass.CONTENT.v;
    }

    isExitCode() {
        return this.textClassString === TextClass.EXITCODE.v;
    }

    isSenderMessage() {
        return this.isInput() || this.isCommand() || this.isSignal();
    }

    isReceiverMessage() {
        return this.isContent() || this.isExitCode();
    }
}