import {
    maintainScrollToBottom,
    remindTabLabel,
    toggleElementEnabled,
    updateElementInfoForScrollToBottom
} from "../elements/element_utils.js";
import {TabPageElementWrapper} from "../elements/tab_element.js";

export class ScriptWindow extends TabPageElementWrapper {
    constructor(scriptTabElementWrapper, scriptName, id, creator=null,
                {}={}) {
        super(scriptTabElementWrapper, scriptName, id, creator);

    }
}