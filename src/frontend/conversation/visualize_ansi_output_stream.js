export function visualizeAnsiOutputStream(ansiOutputStream) {
    let frag = null;
    const { outputSequence, newStartIndex, previousEndsWithNewLine } = ansiOutputStream;
    const otherReturnMessages = [];

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


        if (text.startsWith("\n") && !frag && !previousEndsWithNewLine) {
            text = text.substring(1);
        }

        if (text === "") {
            return;
        }

        if (frag === null) {
            frag = document.createDocumentFragment();
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
        frag.appendChild(newSpan);
    })

    const noEOLIndicator = () => {
        const newSpan = document.createElement("span");
        const textNode = document.createTextNode("NO NEWLINE");
        newSpan.appendChild(textNode);
        newSpan.classList.add("fallback");
        newSpan.classList.add("indicator");
        return newSpan;
    }

    if (frag && !endsWithNewLine) {
        frag.appendChild(noEOLIndicator());
    }

    return {frag, otherReturnMessages};
}