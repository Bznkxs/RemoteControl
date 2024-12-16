const {getStyles} = require("./parse_ansi_message.js");

const AnsiTerminal = require('node-ansiterminal').AnsiTerminal;


class SimpleTerminal extends AnsiTerminal {
    constructor(...args) {
        super(...args);
        this.outputSequence = [];
        this.streamTailLine = 0;
        this.lastMergedStreamTailLine = 0;
        this.endsWithNewLine = true;
        this.previousEndsWithNewLine = true;
    }

    maintainOutputElement(element) {
        // count the number of lines in the element
        if (typeof element.text === "string") {

            element.lines = element.text.split("\n");
        }
    }

    addElementToOutputSequence(element) {
        this.outputSequence.push(element);
        this.maintainOutputElement(element);
        if (element.lines) {
            this.lastTextElementIndex = this.outputSequence.length - 1;
        }
    }

    clearScreen() {
        this.outputSequence = [];
        this.streamTailLine = 0;
        this.lastMergedStreamTailLine = 0;
        this.lastTextElementIndex = null;
        this.endsWithNewLine = true;
        this.previousEndsWithNewLine = true;
    }

    accountRowOffsetForScrollBack(position="top") {
        let currentRow = 0;
        for (let i = 0; i < this.outputSequence.length; i++) {
            // only the last (this.rows) rows will be shown
            if (this.outputSequence[i].lines) {
                currentRow += this.outputSequence[i].lines.length - 1;
            }
        }
        if (position === "top") {  // what is the absolute row offset of the top of the screen?
            currentRow = Math.max(0, currentRow - this.rows);
        }
        else if (position === "bottom") {  // what is the absolute row offset of the bottom (the row after last row) of the screen?
            currentRow = Math.max(this.rows, currentRow + 1);
        } else if (position === "absolute") {  // what is the absolute row offset of the current row?
        } else if (position === "relative") {  // what is the relative row on the screen?
            currentRow = Math.min(this.rows - 1, currentRow);
        }
        return currentRow;
    }

    
    locatePosition(row, col, print=false) {
        // console.log("Locate position", row, col, this.rows, this.cols, typeof this.rows, typeof this.cols)
        // get the required row and col in outputSequence
        let currentRow = this.accountRowOffsetForScrollBack();
        let currentCol = 0;


        row += currentRow;
        // console.log("Accounting for scrollback", row, col, currentRow)
        // console.log("current outputSequence", this.outputSequence)
        let logBuffer = "";
        for (let i = 0; i < this.outputSequence.length; i++) {
            // console.log("i:", i, typeof i);
            let element = this.outputSequence[i];
            if (element.lines) {
                if (currentRow + element.lines.length > row) {
                    // it's in this element. We should count the number of characters in the lines
                    let index = 0;
                    for (let j = 0; j < element.lines.length; j++) {
                        // console.log("j:", j, typeof j);
                        // if (print) {
                        //     if (currentRow + j === row - 1) {
                        //         logBuffer += element.lines[j] + '\n';
                        //     }
                        // }
                        if (currentRow + j === row) {
                            // logBuffer += element.lines[j];
                            let line = element.lines[j];
                            if (currentCol + line.length > col) {
                                if (print) {
                                    // console.log(logBuffer);
                                    // console.log(element, j, currentRow, currentCol, row, col, line.length)
                                }
                                return {
                                    elementIndex: i,
                                    lineIndex: j,
                                    colIndex: col - currentCol,
                                    charIndex: index + col - currentCol,
                                    trailingCol: 0,
                                    trailingRow: 0
                                };
                            } else {
                                if (j === element.lines.length - 1 && i < this.outputSequence.length - 1) {
                                    // the row is in the last line of this element, but the col falls outside
                                    // and there are more elements to come
                                    currentCol += line.length;
                                    break;
                                } else {  // we have found the row, but the row is not that long
                                    if (print) {
                                        // console.log(logBuffer);
                                        // console.log(element, j, currentRow, currentCol, row, col, line.length)
                                    }
                                    return {
                                        elementIndex: i,
                                        lineIndex: j,
                                        colIndex: line.length,
                                        charIndex: index + line.length,  // point to the first existing character after the position
                                        trailingCol: col - currentCol - line.length + 1,
                                        trailingRow: 0
                                    };
                                }
                            }
                        } else {
                            index += element.lines[j].length;
                        }
                    }
                    // did not find the position in this element:
                    // the only way this can happen is that the row
                    // is in the last line, but the col falls outside
                }
                currentRow += element.lines.length - 1;
            }
        }
        // the row is not in the outputSequence
        // if (!lastTextElementIdx) {
        //     return {
        //         elementIndex: null,
        //         lineIndex: 0,
        //         charIndex: 0,
        //         trailingCol: col,
        //         trailingRow: row
        //     };
        // }
        return {
            elementIndex: null,
            lineIndex: 0,
            colIndex: 0,
            charIndex: 0,
            trailingCol: col - currentCol,
            trailingRow: row - currentRow
        }
    }

    getLastPosition() {
        let currentRow = this.accountRowOffsetForScrollBack("relative");
        let currentCol = 0;
        for (let i = this.outputSequence.length - 1; i >= 0; i--) {
            let element = this.outputSequence[i];
            if (element.lines) {
                let lastLine = element.lines[element.lines.length - 1];
                currentCol += lastLine.length;
                if (element.lines.length > 1) {
                    return {
                        row: currentRow,
                        col: currentCol
                    }
                }
            }
        }
        return {
            row: currentRow,
            col: currentCol
        }
    }

    extendToPositionWithWhiteSpace({row, col, position}) {
        // console.log("Extend to position with white space", row, col)
        if (!position)
            position = this.locatePosition(row, col);
        let element;
        let styles = getStyles(this.charattributes, this.colors, false);
        let elementClass = styles[0] || "";
        let elementStyle = styles[1] || "";
        if (position.elementIndex === null) {  // the position is not in the outputSequence; create a new element
            // console.log("Create a new element")
            element = {
                text: "",
                styleValue: String(this.charattributes) + "@" + String(this.colors) + "@" + String(false),
                elementClass,
                elementStyle,
            };
            this.addElementToOutputSequence(element);
            position.elementIndex = this.outputSequence.length - 1;
        } else {
            // console.log("Old element:", this.outputSequence[position.elementIndex].text)
        }
        element = this.outputSequence[position.elementIndex];
        let line = element.lines[position.lineIndex];
        let charIndex = position.charIndex;
        let trailingCol = position.trailingCol;
        let trailingRow = position.trailingRow;
        // console.log(position)
        if (trailingRow === 0 && trailingCol === 0) {
            return;
        }
        if (trailingRow > 0) {
            for (let i = 0; i < trailingRow; i++) {
                element.text += "\n";
            }
        }
        if (trailingCol > 0) {
            element.text = element.text.slice(0, charIndex) +
                " ".repeat(trailingCol) +
                element.text.slice(position.charIndex);
        }
        // console.log("After extendToPositionWithWhiteSpace", element.text)
        this.maintainOutputElement(element);
    }


    
    streamOut(continuousMessage=false) {

        let stream;
        let newStartIndex = 0;
        let returnPreviousEndsWithNewLine = this.previousEndsWithNewLine;
        let sliceStart = 0;
        if (continuousMessage) {
            stream = this.outputSequence.slice(sliceStart = this.lastMergedStreamTailLine);
            newStartIndex = this.streamTailLine - this.lastMergedStreamTailLine;

        } else {
            stream = this.outputSequence.slice(sliceStart = this.streamTailLine);
            this.lastMergedStreamTailLine = this.streamTailLine;
            returnPreviousEndsWithNewLine = this.endsWithNewLine;
        }

        this.streamTailLine = this.outputSequence.length;
        let endsWithNewLine = false;
        for (let i = 0; i < stream.length; i++) {
            let element = stream[i];
            if (element.lines) {
                endsWithNewLine = element.text.endsWith("\n");
            }
        }
        returnPreviousEndsWithNewLine = true;
        for (let i = Math.min(sliceStart, this.outputSequence.length - 1); i >= 0; i--) {
            if (this.outputSequence[i].lines) {
                returnPreviousEndsWithNewLine = this.outputSequence[i].text.endsWith("\n");
                break;
            }
        }

        this.endsWithNewLine = endsWithNewLine;
        // console.log("streamOut", continuousMessage, stream, newStartIndex)
        return {outputSequence: stream, newStartIndex, previousEndsWithNewLine: returnPreviousEndsWithNewLine,
        endsWithNewLine};
    }
    
    inst_p(s) {
        if (this.moveCursor) {
            // console.log("Move cursor", s)
            this.moveCursor(s);
            this.moveCursor = null;
        }
        let text = s;
        let styles = getStyles(this.charattributes, this.colors, false);
        // console.log("Styles", styles)
        let elementClass = styles[0] || "";
        let elementStyle = styles[1] || "";
        let textBlock = {
            text: text,
            styleValue: String(this.charattributes) + "@" + String(this.colors) + "@" + String(false),
            elementClass,
            elementStyle
        };
        // if (this.outputSequence.length && this.outputSequence[this.outputSequence.length - 1].styleValue === textBlock.styleValue) {
        //     this.outputSequence[this.outputSequence.length - 1].text += text;
        // } else
        {
            this.addElementToOutputSequence(textBlock);
        }
        // console.log('print', s);
    }
    inst_o(s) {
        if (s.charAt(0) === "0") {
            this.addElementToOutputSequence({
                elementClass: "unhandled indicator",
                elementStyle: "",
                actionClass: "set-title",
                actionArgs: s.slice(2),
                fallback: `Set Title(${s.slice(2)})`
            })
        } else {
            this.addElementToOutputSequence({
                elementClass: "unhandled indicator",
                elementStyle: "",
                actionClass: "osc",
                actionArgs: s,
                fallback: `OSC(${s})`
            })
        }

        // console.log('osc', s);
    }
    inst_x(flag) {
        if (flag === "\n" || flag === "\t") {
            return this.inst_p(flag);
        }
        if (flag === "\x07") {
            return this.beep();
        }
        let actionClass = "execute";
        let actionArgs = flag.charCodeAt(0);
        let description = "";
        let fallback = null;
        let elementClass = "";
        let elementStyle = "";
        let text = null;
        if (flag === "\x08") {
            description = fallback = "Backspace";
            elementClass = "fallback indicator";
            this.moveCursor = (messageToPrint) => {
                if ((messageToPrint).length > 0) {
                    for (let i = this.outputSequence.length - 1; i >= 0; i--) {
                        if (i < this.lastMergedStreamTailLine) {
                            break;
                        }
                        if (this.outputSequence[i].lines) {
                            let lastLine = this.outputSequence[i].lines[this.outputSequence[i].lines.length - 1];
                            if (lastLine.length > 0) {
                                this.outputSequence[i].text = this.outputSequence[i].text.slice(0, -1);
                                this.maintainOutputElement(this.outputSequence[i]);
                                return;
                            }
                        }
                    }
                    this.addElementToOutputSequence({
                        text, elementClass, elementStyle, actionClass, actionArgs, description, fallback});
                }
            }
            return;
        }
        else if (flag === "\r") {
            description = fallback = "\\r";
            elementClass = "fallback indicator";
        }
        else {
            fallback = JSON.stringify(flag);
            description = "Unknown control character";
            elementClass = "unhandled indicator";
        }
        this.addElementToOutputSequence({
            text: text,
            elementClass,
            elementStyle,
            actionClass: actionClass,
            actionArgs: actionArgs,
            description: description,
            fallback: fallback
        })
        // console.log('execute', flag.charCodeAt(0));
    }
    inst_c(collected, params, flag) {
        // console.log('csi', collected, params, flag);
        if (collected === "" ) {
            switch (flag) {
                case "m":
                case "J":
                case 'X':
                case 'H':
                    super.inst_c(collected, params, flag);
                    // console.log(this.charattributes);
                    // console.log(this.textattributes);
                    // console.log(this.reverse_video);
                    // console.log(this.colors);
                    return;
            }

        }
        else if (collected === "?" && (flag === "h" || flag === "l")) {
            // ignore
            return;
        }

        {
            this.addElementToOutputSequence({
                actionClass: "csi",
                actionArgs: [collected, params, flag],
                elementClass: "unhandled indicator",
                fallback: `CSI(${collected ? collected + ', ' : '' }${params}, ${flag})`

            })
        }
    }

    getLastOutputElement() {
        if (this.outputSequence.length === 0) {
            return null;
        }
        return this.outputSequence[this.outputSequence.length - 1];
    }

    removeLastOutputElement() {
        this.outputSequence.pop();
        if (this.streamTailLine > this.outputSequence.length) {
            this.streamTailLine = this.outputSequence.length;
        }
    }

    ECH(params) {
        const lastElement = this.getLastOutputElement();
        const erase = ((params[0]) ? params[0] : 1);
        if (lastElement && lastElement.actionClass === "CUP") {  // erase characters from the cursor position
            // console.log("lastElement", lastElement)
            const row = lastElement.actionArgs.row;
            const col = lastElement.actionArgs.col;
            const position = this.locatePosition(row, col);

            if (position.elementIndex && position.trailingRow === 0 && position.trailingCol === 0) {  // the position is in one of the existing elements
                const element = this.outputSequence[position.elementIndex];
                const endIndex = position.charIndex +
                    Math.min(erase, element.lines[position.lineIndex].length - col);
                element.text = element.text.slice(0, position.charIndex) +
                    " ".repeat(endIndex - position.charIndex) +
                    element.text.slice(endIndex);
            }
            // return;
        }

        // this.addElementToOutputSequence({
        //     actionClass: "ECH",
        //     actionArgs: params,
        //     elementClass: "fallback indicator",
        //     fallback: `CSI(${erase}, X)`
        // });
    }

    ED(params) {
        let fallback = "";
        let elementClass = "unhandled indicator";
        switch ((params) ? params[0] : 0) {
            case 0:
                fallback = "Clear Below";
                break;
            case 1:
                fallback = "Clear Above";
                break;
            case 2:
                fallback = "Clear Display";
                elementClass = "fallback indicator";
                this.clearScreen();
                break;
        }
        this.addElementToOutputSequence({
            actionClass: "ED",
            actionArgs: params,
            elementClass: elementClass,
            fallback: fallback
        })
    }

    CUP(params) {
        const row = ((params) ? (params[0] || 1) : 1) - 1;
        const col = ((params) ? (params[1] || 1) : 1) - 1;
        const position = this.locatePosition(row, col, true);
        // console.log("CUP", position, row, col, this.outputSequence.length)
        const {elementIndex, lineIndex, charIndex, colIndex, trailingCol, trailingRow} = position;
        const defaultFallback = () => {
            this.addElementToOutputSequence({
                actionClass: "CUP",
                actionArgs: {row, col},
                elementClass: "fallback indicator",
                fallback: `Cursor Position(${row}, ${col})`
            });
        }
        if (elementIndex && trailingRow === 0) {  // the position is in one of the existing elements
            if (elementIndex < this.lastMergedStreamTailLine) {  // the position falls in the scrollback buffer

                // console.log("inside CUP", position, this.lastTextElementIndex, this.outputSequence[elementIndex].text.length - 1);
                return defaultFallback();


            } else {  // the position falls in the current buffer; we need to check if position is not at the last line of the text
                let allEmptyLineAfter = true;  // check if all lines after the position are empty
                // console.log("Check all empty lines after", lineIndex, this.outputSequence[elementIndex].lines.length)
                let newLineIndex = 1;
                let charsInLineAfterPosition = this.outputSequence[elementIndex].lines[lineIndex].slice(colIndex);
                for (let i = lineIndex + 1; i < this.outputSequence[elementIndex].lines.length; i++) {
                    if (this.outputSequence[elementIndex].lines[i].trim() !== "") {
                        allEmptyLineAfter = false;
                        break;
                    }
                    newLineIndex = 0;
                }

                for (let i = elementIndex + 1; i < this.outputSequence.length; i++) {
                    if (this.outputSequence[i].lines) {  // for all elements after the position that are in the same line of the position, ignore that line
                        if (newLineIndex) {
                            charsInLineAfterPosition += this.outputSequence[i].lines[0];
                        }
                        for (let j = newLineIndex; j < this.outputSequence[i].lines.length; j++) {
                            if (this.outputSequence[i].lines[j].trim() !== "") {
                                allEmptyLineAfter = false;
                                break;
                            }
                            newLineIndex = 0;
                        }
                        if (!allEmptyLineAfter) {
                            break;
                        }
                    }
                    else {  // if this element is not a text element, we cannot delete it.
                        allEmptyLineAfter = false;
                        break;
                    }
                }
                if (allEmptyLineAfter) {  // if the position is in the last non-empty line: put into buffer
                    const elementsToRemove = this.outputSequence.length - elementIndex - 1;  // any element after elementIndex should be removed
                    let nonEmptyCharsToOverwrite = charsInLineAfterPosition.trimEnd().length;

                    // since we move the cursor there, we delete all characters after the cursor
                    console.log("CUP buffered", row, col, position)
                    this.moveCursor = (messageToPrint) => {
                        console.log("Move cursor", messageToPrint, messageToPrint.length, elementsToRemove, nonEmptyCharsToOverwrite)
                        if (elementIndex >= this.lastMergedStreamTailLine && messageToPrint.length >= nonEmptyCharsToOverwrite) {
                            this.outputSequence[elementIndex].text = this.outputSequence[elementIndex].text.slice(0, charIndex);
                            this.maintainOutputElement(this.outputSequence[elementIndex]);
                            for (let i = 0; i < elementsToRemove; i++) {
                                this.removeLastOutputElement();
                            }
                        } else {
                            defaultFallback();
                        }
                    }
                    return;
                } else {
                    return defaultFallback();
                }
            }
        }
        // console.log("outside CUP", position, this.lastTextElementIndex, elementIndex === null? null:this.outputSequence[elementIndex].text.length - 1)
        this.moveCursor = () => {this.extendToPositionWithWhiteSpace({row, col, position});}  // fill the gap with white space
    }

    inst_e(collected, flag) {
        this.addElementToOutputSequence({
            actionClass: "esc",
            actionArgs: [collected, flag]
        })
        // console.log('esc', collected, flag);
    }
    inst_H(collected, params, flag) {
        // console.log('dcs-Hook', collected, params, flag);
        this.addElementToOutputSequence({
            actionClass: "dcs-hook",
            actionArgs: [collected, params, flag]
        })
    }
    inst_P(dcs) {
        this.addElementToOutputSequence({
            actionClass: "dcs-put",
            actionArgs: dcs
        })
        // console.log('dcs-Put', dcs);
        }
    inst_U() {
        this.addElementToOutputSequence({
            actionClass: "dcs-unhook",
            actionArgs: ""
        })
        // console.log('dcs-Unhook');
    }
};


module.exports = {SimpleTerminal};