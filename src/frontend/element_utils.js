export const clearText = (element) => {
    element.innerHTML = "";
};

const isElementEnabled = (element) => {
    // if element is a div, it will not have a disabled property. Look at the classList instead
    if (element.disabled === undefined) {
        return !element.classList.contains("disabled");
    }
    return !element.disabled;
};
const isElementVisible = (element) => {
    return !(element.display === "none");
}
export const toggleElementVisibility = (element, visible) => {
    if (visible === undefined) {
        toggleElementVisibility(element, !isElementVisible(element));
    } else {
        if (visible) {
            if (element.makeVisible) {
                element.makeVisible();
            } else {
                element.style.display = "";
            }
            element.makeVisible = undefined;
        } else {
            if (!element.makeVisible) {
                const display = element.style.display;
                element.makeVisible = () => {
                    element.style.display = display;
                }
                element.style.display = "none";
            } else {
                element.style.display = "none";
            }
        }
    }

}
export const toggleElementEnabled = (element, enabled) => {
    if (enabled === undefined) {
        toggleElementEnabled(element, !isElementEnabled(element));
    } else {
        if (enabled) {
            if (isElementEnabled(element)) {
                return;
            }
            element.classList.remove("disabled");
            element.disabled = false;
        } else {
            if (!isElementEnabled(element)) {
                return;
            }
            element.classList.add("disabled");
            element.disabled = true
        }
        toggleElementVisibility(element, enabled);
    }
};

export function remindTabLabel(tabLabel) {
    if (!tabLabel.classList.contains("active")) {
        tabLabel.classList.add("remind");
    }
}

export function updateElementInfoForScrollToBottom(divElement) {
    divElement.isScrolledToBottom = divElement.scrollHeight - divElement.scrollTop <= divElement.clientHeight + 1;
}

export function maintainScrollToBottom(divElement) {
    // console.log("Maintaining scroll to bottom:", divElement.isScrolledToBottom);
    // If it was scrolled to the bottom, scroll it back to the bottom after the update
    if (divElement.isScrolledToBottom) {
        divElement.scrollTop = divElement.scrollHeight;
        // console.log("Scrolling to bottom:", divElement.scrollTop, divElement.scrollHeight);
    }
}