/**
 * code from https://github.com/netzkolchose/jquery.browserterminal/blob/master/dist/js/jquery.browserterminal.js
 */
//
const getANSITerminal = window.ansiAPI.getANSITerminal;
const getSimpleTerminal = window.ansiAPI.getSimpleTerminal;

export
function getInputHintMarker() {
    const emptySpan = document.createElement('span');
    emptySpan.classList.add('emptySpan');
    return emptySpan;
}

var BITS = {
    1: 'bold',
    2: 'italic',
    4: 'underline',
    8: 'blink',
    16: 'inverse',
    32: 'conceal',
    64: 'c'
};

var MAP = function() {
    var m = [];
    for (var i=0; i<128; ++i) {
        var entry = [];
        for (var j in BITS) {
            if (i & j)
                entry.push(BITS[j]);
        }
        m.push(entry.join(' '));
    }
    return m;
}();

export
function getStyles(num, gb, fullwidth) {
    var fg_rgb = num&67108864 && num&134217728;
    var bg_rgb = num&16777216 && num&33554432;
    // if (not RGB) and (fg set) and (bold set) and (fg < 8)
    var intense_on_bold = (!fg_rgb && num&67108864 && num&65536 && (num>>>8&255) < 8) ? 1 : 0;
    var inverse = num&1048576;
    var styles = [
        MAP[num>>>16 & 127]
        + ((num&67108864 && !fg_rgb) ? ((inverse)?' bg':' fg')+((intense_on_bold)?(num>>>8&255)|8:num>>>8&255) : '')
        + ((num&16777216 && !bg_rgb) ? ((inverse)?' fg':' bg')+(num&255) : '')
    ];
    // post check for default colors on inverse
    if (inverse && !(num&67108864))
        styles[0] += ' bg-1';
    if (inverse && !(num&16777216))
        styles[0] += ' fg-1';
    if (fullwidth)
        styles[0] += ' fw';
    var s = '';
    if (fg_rgb)
        s += ((inverse)?'background-color:rgb(':'color:rgb(') + [num>>>8&255, gb>>>24, gb>>>8&255].join(',') + ');';
    if (bg_rgb)
        s += ((inverse)?'color:rgb(':'background-color:rgb(') + [num&255, gb>>>16&255, gb&255].join(',') + ');';
    styles.push(s);
    return styles;
}
function fontwidth(charcode) {
    return charcode < 0x2e80;
}

function getFirstNonEmptyChars(buffer, maxNumber = 1) {
    const result = [];
    for (var i = 0; i < buffer.length; ++i) {
        for (var j = 0; j < buffer[i].cells.length; ++j) {
            if (buffer[i].cells[j].c !== '') {
                result.push( {
                    row: i,
                    col: j,
                    c: buffer[i].cells[j].c
                });
                if (result.length >= maxNumber) {
                    return result;
                }
            }
        }
    }
    return result;
}

export
function parseAnsiMessage(message, previousInfo, previousIsContent) {
    let mergeWithPrevious = previousIsContent;
    const {buffer, cursor} = getANSITerminal(message);
    console.log("cursor", cursor);
    const returnCursor = {col: cursor.col, row: cursor.row};
    const previousCursor = previousInfo ? previousInfo.cursor : null;
    // if previous message is content, and previous cursor is not null
    if (previousIsContent && previousCursor) {
        // check first non-empty chars. If the same, merge with previous
        const firstNonEmptyChars = getFirstNonEmptyChars(buffer, 2);
        const previousFirstNonEmptyChars = getFirstNonEmptyChars(previousInfo.buffer, 2);
        if (firstNonEmptyChars.length === previousFirstNonEmptyChars.length) {
            for (var i = 0; i < firstNonEmptyChars.length; ++i) {
                if (firstNonEmptyChars[i].c !== previousFirstNonEmptyChars[i].c || firstNonEmptyChars[i].row !== previousFirstNonEmptyChars[i].row || firstNonEmptyChars[i].col !== previousFirstNonEmptyChars[i].col) {
                    mergeWithPrevious = false;
                    break;
                }
            }
        }
    } else {
        mergeWithPrevious = false;
        // if cursor is after previous cursor, remove previous content
        if (previousCursor && cursor.row >= previousCursor.row
            && (cursor.row !== previousCursor.row || cursor.col >= previousCursor.col)) {
            if (cursor.row === previousCursor.row) {
                cursor.col -= previousCursor.col;
            }
            cursor.row -= previousCursor.row;

            for (var i = 0; i < previousCursor.row; ++i) {
                buffer.shift();
            }
            // if (previousCursor.row === 0) {
            buffer[0].cells = buffer[0].cells.slice(previousCursor.col);
        }
    }


    console.log(buffer)

    /* buffer: [{cells: [{attr, gb, width, c}]}]
    * cursor: {col, row} */
    // remove all trailing spaces and newlines
    for (var i = 0; i < buffer.length; ++i) {
        for (var j = buffer[i].cells.length - 1; j >= 0; --j) {
            if ((buffer[i].cells[j].c === '' && buffer[i].cells[j].width === 1 && buffer[i].cells[j].attr === 0 && buffer[i].cells[j].gb === 0)) {
                buffer[i].cells.pop();
            } else {
                break;
            }
        }
    }
    // remove all trailing empty lines
    for (var i = buffer.length - 1; i >= 0; --i) {
        if (buffer[i].cells.length === 0) {
            buffer.pop();
        } else {
            break;
        }
    }
    console.log(buffer);
    var frag = document.createDocumentFragment(),
        span = null,
        clas = null,
        s = '',
        old_attr = 0,
        attr = 0,
        old_gb = 0,
        gb = 0,
        width = 1,
        code = 0,
        styles;

    for (var i=0; i<buffer.length; ++i) {
        for (var j=0; j<buffer[i].cells.length; ++j) {

            attr = buffer[i].cells[j].attr;
            gb = buffer[i].cells[j].gb;
            width = buffer[i].cells[j].width;
            code = buffer[i].cells[j].c.charCodeAt(0) | 0;
            if (width && code < 0x2e80 && (fontwidth(code) || buffer[i].cells[j].c === '')) {
                if ((old_attr !== attr) || (old_gb !== gb)) {
                    if (old_attr || old_gb) {
                        span.textContent = s;
                        frag.appendChild(span);
                        s = '';
                    }
                    if (attr || gb) {
                        if (s) {
                            frag.appendChild(document.createTextNode(s));
                            s = '';
                        }
                        span = document.createElement('span');

                        styles = getStyles(attr, gb, (width === 2));
                        // classes
                        if (styles[0]) {
                            clas = document.createAttribute('class');
                            clas.value = styles[0];
                            span.setAttributeNode(clas);
                        }
                        // style
                        if (styles[1]) {
                            var style = document.createAttribute('style');
                            style.value = styles[1];
                            span.setAttributeNode(style);
                        }
                        // cursor
                        if (attr & 4194304) {
                            var data_contents = document.createAttribute('data-contents');
                            data_contents.value = buffer[i].cells[j].c || '\xa0';
                            span.setAttributeNode(data_contents);
                            if (this.terminal.blinking_cursor)
                                clas.value += ' blc';
                        }
                    }
                    old_attr = attr;
                    old_gb = gb;
                }
                s += buffer[i].cells[j].c || '\xa0';
            } else if (width == 0) {
                s += buffer[i].cells[j].c;
            } else if (width == 2 || !fontwidth(buffer[i].cells[j].c.charCodeAt(0))) {
                if (true) {
                    if (old_attr || old_gb) {
                        span.textContent = s;
                        frag.appendChild(span);
                        s = '';
                    }
                    if (true) {
                        if (s) {
                            frag.appendChild(document.createTextNode(s));
                            s = '';
                        }
                        span = document.createElement('span');
                        styles = getStyles(attr, gb, true);
                        // classes
                        if (styles[0]) {
                            clas = document.createAttribute('class');
                            clas.value = styles[0] + ((width == 1) ? this.fontMetrics['hw-class'] : this.fontMetrics['fw-class'] + ' fw-corr');
                            span.setAttributeNode(clas);
                        }
                        // style
                        if (styles[1]) {
                            var style = document.createAttribute('style');
                            style.value = styles[1];
                            span.setAttributeNode(style);
                        }
                        // cursor
                        if (attr & 4194304) {
                            var data_contents = document.createAttribute('data-contents');
                            data_contents.value = buffer[i].cells[j].c || '\xa0';
                            span.setAttributeNode(data_contents);
                            if (this.terminal.blinking_cursor)
                                clas.value += ' blc';
                        }
                    }
                    old_attr = -1;
                    old_gb = -1;
                }
                s += buffer[i].cells[j].c;
            }
        }
        if (old_attr || old_gb) {
            old_attr = 0;
            old_gb = 0;
            // s = s.trimEnd();
            span.textContent = s;
            frag.appendChild(span);

        } else {
            // s = s.trimEnd();
            frag.appendChild(document.createTextNode(s));
        }
        // judge cursor position: if cursor is in the last non-empty line, do not add a newline
        if (cursor.row === i && cursor.col >= buffer[i].cells.length - 1 && cursor.row === buffer.length - 1) {
            // frag.appendChild(document.createTextNode('\n'));
            const emptySpan = getInputHintMarker();
            frag.appendChild(emptySpan);
        } else {
            frag.appendChild(document.createTextNode('\n'));
        }
        s = '';
        // span = null;
    }
    previousInfo.cursor = returnCursor;
    previousInfo.buffer = buffer;
    return {frag, cursor: returnCursor, mergeWithPrevious};
}

export
function parseSimpleMessage(container, message, previousInfo, mergeWithPrevious) {
    const terminalIdentifier = container.id;
    const {outputSequence} = getSimpleTerminal({name: terminalIdentifier, rawOutput: message});
    const frag = document.createDocumentFragment();
    let returnLastOutput = null;
    outputSequence.forEach((output) => {
        let text = output.text;
        if (text === null || text === undefined) {
            text = output.fallback || "";
        }
        if (text === null || text === undefined) {
            return;
        }
        if ((output.actionClass === "set-title") && (container)) {
            container.parentElement.parentElement.getElementsByClassName("tab-head")[0].firstElementChild.textContent = output.actionArgs;
            return;
        }
        if (previousInfo && previousInfo.lastOutputEndsWithN === false && returnLastOutput === null &&
            mergeWithPrevious && text.startsWith("\n")) {
            // const oldText = JSON.stringify(text);
            text = text.substring(1);  // remove the newline, since it is merged with the previous
            // text = oldText + ",text.substring(1)" + text;
        } else {
            // text = "lastOutputEndsWithN=" + previousInfo.lastOutputEndsWithN + "," + text;
        }
        if (!text) {
            return;
        }
        const newSpan = document.createElement("span");
        const textNode = document.createTextNode(text);
        newSpan.appendChild(textNode);
        if (output.elementClass) {
            const elementClass = document.createAttribute('class');
            elementClass.value = output.elementClass;
            newSpan.setAttributeNode(elementClass);
        }
        if (output.elementStyle) {
            newSpan.style = output.elementStyle;
        }
        returnLastOutput = text;
        frag.appendChild(newSpan);
    })
    return {frag, mergeWithPrevious, lastOutputEndsWithN: returnLastOutput === null ? null: returnLastOutput.endsWith("\n")};
}