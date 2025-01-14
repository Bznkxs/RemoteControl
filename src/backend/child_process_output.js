export class ChildProcessOutput {
    /**
     *
     * @param {string|AnsiOutputStream?} text
     * @param {string|AnsiOutputStream?} end The end of the output that belongs to the same output event, but is not the output itself.
     * @param {any?} args
     */
    constructor(text, end, args) {
        this.text = text;
        this.end = end;
        this.args = args;
    }
}