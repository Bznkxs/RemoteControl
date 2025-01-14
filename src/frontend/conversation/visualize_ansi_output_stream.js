export function visualizeAnsiOutputStream(ansiOutputStream) {
    let frag = null;
    const { outputSequence, newStartIndex, previousEndsWithNewLine } = ansiOutputStream;
    const otherReturnMessages = [];

    const noEOLIndicator = () => {
        const newSpan = document.createElement("span");
        newSpan.classList.add("no-new-line-indicator");
        newSpan.classList.add("fallback");
        newSpan.classList.add("indicator");
        return newSpan;
    }

    const newLineIndicator = () => {
        const newSpan = document.createElement("span");
        newSpan.classList.add("new-line-indicator");
        return newSpan;
    }

    let endsWithNewLine = false;
    outputSequence.forEach((output, index) => {
        let text = output.text;
        if (text === null || text === undefined) {
            text = output.fallback;
        }
        if (text === null || text === undefined) {
            return;
        }
        if (output.actionClass === "set-title") {

            otherReturnMessages.push({action: "set-title", text: output.actionArgs});
            return;
        }

        endsWithNewLine = text.endsWith("\n");




        if (text === "") {
            return;
        }

        if (frag === null) {
            frag = document.createDocumentFragment();
            // if (!previousEndsWithNewLine) frag.appendChild(noEOLIndicator());

            if (!previousEndsWithNewLine) {
                if (text.startsWith("\n")) {
                    frag.appendChild(newLineIndicator());
                    text = text.substring(1);
                } else {
                    frag.appendChild(noEOLIndicator());
                }

            }
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
        if (output.actionClass === "file-entry") {
            newSpan.classList.add("file-entry");
            newSpan.innerHTML = text;
            otherReturnMessages.push({action: "file-entry", text: text, element: newSpan, output: output});
        }
        frag.appendChild(newSpan);
    })



    // if (frag && !endsWithNewLine) {
    //     frag.appendChild(noEOLIndicator());
    // }

    return {frag, otherReturnMessages};
}