export class AnsiOutputStream {
    /**
     * @param {Array<{text?: string, elementClass?, elementStyle?, actionClass?, actionArgs?, description?, fallback?}>} outputSequence
     * @param {number} newStartIndex
     * @param {boolean} previousEndsWithNewLine
     * @param {boolean} endsWithNewLine
     */

    constructor(outputSequence, newStartIndex, previousEndsWithNewLine, endsWithNewLine) {
        this.outputSequence = outputSequence;
        this.newStartIndex = newStartIndex;
        this.previousEndsWithNewLine = previousEndsWithNewLine;
        this.endsWithNewLine = endsWithNewLine;
    }

    get length() {
        return this.outputSequence.length;
    }

    slice(start, end) {
        return new AnsiOutputStream(this.outputSequence.slice(start, end),
            Math.max(0, this.newStartIndex - start? start : 0),
            this.prefixEndsWithNewLine(start), this.prefixEndsWithNewLine(end));
    }

    /**
     * Join two AnsiOutputStreams together
     * @param other
     * @returns {AnsiOutputStream}
     */
    join(other) {
        console.log("[AnsiOutputStream] join: ", JSON.stringify(this), JSON.stringify(other))
        if (other.newStartIndex !== 0 && this.newStartIndex < this.outputSequence.length) {
            throw new Error("If this.newStartIndex < this.outputSequence.length, then other.newStartIndex must be 0");
        }
        const ret = new AnsiOutputStream(this.outputSequence.concat(other.outputSequence),
            other.newStartIndex + Math.min(this.newStartIndex, this.outputSequence.length), this.previousEndsWithNewLine, other.endsWithNewLine);
        console.log("[AnsiOutputStream] joined: ", JSON.stringify(ret))
        return ret;
    }

    prefixEndsWithNewLine(upperIndex) {
        if (upperIndex === undefined || upperIndex === this.outputSequence.length) {
            return this.endsWithNewLine;
        }
        for (let i = upperIndex - 1; i >= 0; --i) {
            if (this.outputSequence[i].text) {
                return this.outputSequence[i].text.endsWith("\n");
            }
        }
        return this.previousEndsWithNewLine;
    }

    get plainText() {
        if (this._plainText === undefined) {
            this._positions = [];
            let currentLength = 0;
            this._plainText = this.outputSequence.map((output) => {
                const ret = output.text || '';
                this._positions.push(currentLength);
                currentLength += ret.length;
                return ret;
            }).join("");
        }
        return this._plainText;
    }

    /**
     * Split the output stream by text index.
     * @param index
     * @returns {AnsiOutputStream[]}
     */
    splitByIndex(index) {
        if (index === 0) return [AnsiOutputStream.empty(), this];
        let currentLength = 0;
        for (let i = 0; i < this.outputSequence.length; i++) {
            const output = this.outputSequence[i];
            if (!output.text) continue;
            if (currentLength + output.text.length > index) {
                const text = [output.text.slice(0, index - currentLength), output.text.slice(index - currentLength)];

                return [
                    new AnsiOutputStream(
                        this.outputSequence.slice(0, i).concat({
                            text: text[0],
                            elementClass: output.elementClass,
                            elementStyle: output.elementStyle,
                            actionClass: output.actionClass,
                            actionArgs: output.actionArgs,
                            description: output.description,
                            fallback: output.fallback
                        }),
                        Math.min(this.newStartIndex, i + 1),
                        this.previousEndsWithNewLine,
                        text[0].endsWith("\n")
                    ),
                    new AnsiOutputStream(
                        [{
                            text: text[1],
                            elementClass: output.elementClass,
                            elementStyle: output.elementStyle,
                            actionClass: output.actionClass,
                            actionArgs: output.actionArgs,
                            description: output.description,
                            fallback: output.fallback
                        }].concat(this.outputSequence.slice(i + 1)),
                        Math.max(0, this.newStartIndex - i),
                        text[0].endsWith("\n"),
                        this.endsWithNewLine
                    )
                ];
            }
            if (currentLength + output.text.length === index) {
                return [new AnsiOutputStream(this.outputSequence.slice(0, i + 1), Math.min(this.newStartIndex, i + 1), this.previousEndsWithNewLine, output.text.endsWith("\n")),
                    new AnsiOutputStream(this.outputSequence.slice(i + 1), Math.max(0, this.newStartIndex - i - 1), output.text.endsWith('\n'), this.endsWithNewLine)];
            }
            currentLength += output.text.length;
        }
        return [this, AnsiOutputStream.empty()];
    }

    static empty() {
        return new AnsiOutputStream([], 0, true, false);
    }
}