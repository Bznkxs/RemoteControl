import {dataContains} from "../text_processing.js";

function getLineOfCall(depth=3) {
    const err = new Error();
    const stackLines = err.stack.split("\n");

    // The calling line is usually the third line of the stack trace
    const callerLine = stackLines[depth].trim();  // where the function that called this function is called
    const [callerRow, callerColumn] = callerLine.split(":").slice(-2);
    const callerFunction = callerLine.split(" ")[1];
    console.log(stackLines, callerLine, callerFunction, callerRow, callerColumn);
    return {callerFunction, callerRow, callerColumn};
}

function inferConsumeInput(transitionInput) {
    if (transitionInput instanceof RegExp || typeof transitionInput === "string" || transitionInput instanceof String) {
        return true;
    }
    if (transitionInput instanceof Array) {
        let retVal = false;
        for (const item of transitionInput) {
            retVal |= inferConsumeInput(item);
        }
        return retVal;
    }
    if (transitionInput instanceof Function || typeof transitionInput === "function") {
        return transitionInput.length > 0;
    }
    if (transitionInput === null || transitionInput === undefined) {
        return false;
    }
    throw new Error("Cannot infer consumeInput from transitionInput" + transitionInput);
}

class AutomatonState {
    constructor(info={}) {
        this.info = info;
        this.transitions = {};
        this.transitionInputList = [];
        this.value = null;
        this.arrivalCallback = null;
  // the default arrival action
    }


    /**
     *
     * @param transitionInput
     * @param {AutomatonState} state
     * @param departAction
     * @param existedAction
     * @param consumeInput
     */
    addTransition(transitionInput, state, departAction=null, existedAction="error",
                  consumeInput=null) {
        if (!(state instanceof AutomatonState)) throw new Error("State must be an instance of AutomatonState");
        if (this.transitions[transitionInput]) {
            if (existedAction === "error") {
                throw new Error("Transition already exists");
            }
            else if (existedAction === "ignore") {
                return;
            }
            else if (existedAction === "overwrite") {  // not only overwrite the transition behavior, but also the priority
                delete this.transitions[transitionInput];
                const index = this.transitionInputList.indexOf(transitionInput);
                this.transitionInputList.splice(index, 1);
            }
            else {
                throw new Error("Invalid existedAction");
            }
        }
        if (consumeInput === null) {
            // infer the consumeInput from the transitionInput
            consumeInput = inferConsumeInput(transitionInput);
        }
        this.transitions[transitionInput] = {state, departAction, consumeInput, transitionInput};
        this.transitionInputList.push(transitionInput);
    }


    /**
     * Only used to get the transition edge. Use input() to get the next state of a c
     * @param transitionInput
     * @returns {*}
     */
    getTransition(transitionInput) {
        return this.transitions[transitionInput];
    }

    input(symbol, allowEpsilon=true) {
        const epsilonTransition = this.getTransition(null);
        console.log("Input", symbol, "at", this.info.name, "with epsilon", epsilonTransition, "allowEpsilon", allowEpsilon)
        for (const transition of this.transitionInputList) {
            if (transition !== null && dataContains(symbol, transition)) {
                return this.transitions[transition];
            }
        }
        // epsilonTransition always has the lowest priority
        return allowEpsilon ? epsilonTransition || null : null;
    }

    addArrivalAction(action) {
        this.info.arrivalAction = action;
    }

    async doActionOnly(...data) {
        if (this.info.arrivalAction) {
            console.log(`Action(${this.info.name}:${this.info.description}, ${data})`);
            this.value = await Promise.resolve(this.info.arrivalAction(...data));
            return this.value;
        } else {
            return null;
        }
    }

    action(...data) {
        this.doActionOnly(...data).then((value) => {
            if (this.arrivalCallback) {
                this.arrivalCallback(value);
            }
        });
    }
}

class Automaton {
    constructor() {
        this.states = {};
        this.stateList = [];
        this.endStates = new Set();
        this.currentState = null;
        this.startState = null;
    }

    createState(name, action=null, start=false, end=false) {
        const newState = new AutomatonState({name, start, end});
        if (action) {
            newState.addArrivalAction(action);
        }

        this.states[name] = newState;
        this.stateList.push(newState);
        newState.info.index = this.stateList.length - 1;
        if (start) {
            this.startState = newState;  // Only one start state
        }
        if (end) {
            this.endStates.add(newState);
        }
        return newState;
    }

    reset() {
        this.currentState = this.startState;
        this.accumulation = ""
    }

    getState(state) {
        if (!(state instanceof AutomatonState)) {
            return this.states[state];
        } else {
            return state;
        }
    }

    createTransition(from, to, input=null, departAction=null, existedAction="error") {
        from = this.getState(from);
        to = this.getState(to);
        if (!from || !to) {
            throw new Error("Invalid state");
        }
        from.addTransition(input, to, departAction, existedAction);
    }

    registerActionPerformedListener(listener) {
        if (!this.actionPerformedListeners) {
            this.actionPerformedListeners = [];
        }
        this.actionPerformedListeners.push(listener);
    }

    sendActionPerformed(info) {
        for (const listener of this.actionPerformedListeners) {
            listener(info);
        }
    }


    /**
     *
     * @param symbol
     * @param actionArgs
     * @param accumulate
     * @param allowEpsilon
     * @returns {Promise<boolean>} // Returns true if the symbol transitions
     */
    async input(symbol, actionArgs=null, accumulate=true, allowEpsilon=true) {
        console.log("Automaton.input", this.accumulation, symbol, "at", this.currentState.info.name);
        console.log(this)
        let symbolText = symbol;
        if (symbol && typeof symbol.text === "string") {
            symbolText = symbol.text;
        }
        if (accumulate && typeof symbolText === "string") {
            symbolText = this.accumulation + symbolText;
            this.accumulation = "";
        }
        console.log("Normalized symbolText", symbolText, "at", this.currentState.info.name)
        const transition = this.currentState.input(symbolText, allowEpsilon);  // get the transition
        console.log("Transition", transition, "at", this.currentState.info.name)
        let retVal = false;
        if (transition) {  // if the transition of the corresponding symbol exists
            if (transition.departAction) {
                await transition.departAction({symbol, symbolText}, actionArgs);
            }
            this.currentState = transition.state;  // move to the next state
            // run actions
            retVal = true;
            await this.currentState.doActionOnly({symbol, symbolText}, actionArgs);
            this.sendActionPerformed(this.currentState.info);
            if (transition.consumeInput) {
                symbol = null;
            }

            // recursively call input until there is no transition.
            await this.input(symbol, actionArgs, accumulate, allowEpsilon);
        }
        if (!retVal) {
            this.accumulation = symbolText || "";
        }
        return retVal;
    }

    isAccepting() {
        return this.currentState.end;
    }
}


export
class AutomatonSugar extends Automaton {
    constructor() {
        super();
        this.sugarInfo = {
            lastState: () => {
                return this.stateList[this.stateList.length - 1];
            },

            stack: [{root: null, type: "root", branches: [null]}],
            currentStack: () => { return this.sugarInfo.stack[this.sugarInfo.stack.length - 1]; },
            currentPointer: () => { return this.sugarInfo.currentStack().branches[this.sugarInfo.currentStack().branches.length - 1]; },
            setCurrentPointer: (pointer) => { this.sugarInfo.currentStack().branches[this.sugarInfo.currentStack().branches.length - 1] = pointer; },
        }
    }



    DoOn(contains, action, previousState=null) {
        if (!previousState) {
            if (!this.sugarInfo.currentPointer()) {
                if (this.stateList.length === 0) {
                    this.createState(0, null, true);
                    this.sugarInfo.stack[0].root = this.stateList[0];
                    this.sugarInfo.stack[0].branches[0] = this.stateList[0];
                }
                this.sugarInfo.setCurrentPointer(this.sugarInfo.lastState());

                // console.log("stack", this.sugarInfo.stack)
                // console.log("currentStack", this.sugarInfo.currentStack())
                // console.log("currentPointer", this.sugarInfo.currentPointer())
            }
            previousState = this.sugarInfo.currentPointer();
        }
        const newState = this.createState(this.stateList.length, action);
        newState.info.description = "DOOn(" + String(contains) + ")";
        newState.info.lineOfCall = getLineOfCall();
        this.createTransition(previousState, newState, contains);
        this.sugarInfo.setCurrentPointer(newState);
        return newState;
    }

    Do(action, on=null) {
        const newState = this.DoOn(on, action);
        newState.info.description = "DO";
        newState.info.lineOfCall = getLineOfCall();
        return newState;
    }

    If(condition) {
        if (inferConsumeInput(condition)) {
            throw new Error("If condition must not consume input");
        }
        const ifBase = this.sugarInfo.currentPointer();
        this.sugarInfo.stack.push({root: ifBase, type: "if", branches: [null]});
        const newState = this.DoOn(condition, null, ifBase);
        newState.info.description = "IF(" + String(condition) + ")";
        newState.info.lineOfCall = getLineOfCall();
        return newState;
    }
    Else(condition) {   // if used as Else(condition), this is actually an else if
        if (inferConsumeInput(condition)) {
            throw new Error("Else condition must not consume input");
        }
        const ifBase = this.sugarInfo.stack[this.sugarInfo.stack.length - 1].root;
        this.sugarInfo.currentStack().branches.push(null);
        const newState = this.DoOn(condition, null, ifBase);
        newState.info.description = "ELSE(" + String(condition) + ")";
        newState.info.lineOfCall = getLineOfCall();
        return newState;
    }
    Endif() {
        const lastStack = this.sugarInfo.stack.pop();
        if (lastStack.type !== "if") {
            throw new Error("Endif without If");
        }
        const newState = this.createState(this.stateList.length, null, false, false);
        newState.info.description = "ENDIF";
        newState.info.lineOfCall = getLineOfCall();
        this.sugarInfo.setCurrentPointer(newState);
        console.log(this);
        console.log("Endif", newState, lastStack.branches);
        // Connect the stack root to the new state
        this.createTransition(lastStack.root, newState, null, null, "ignore");
        for (const branch of lastStack.branches) {
            this.createTransition(branch, newState, null, null, "ignore");
        }
        return newState;
    }
    GOTO(state, on=null) {  // actually "if (contains) goto"
        const newState = this.createState(this.stateList.length, null, false, false);
        this.createTransition(this.sugarInfo.currentPointer(), newState, on);
        newState.info.description = "GOTO(" + String(on) + ")";
        newState.info.lineOfCall = getLineOfCall();
        console.log("Goto", newState, state);
        this.createTransition(newState, state);
        return newState;
    }
    End() {
        const endState = this.Do();
        endState.end = true;
        endState.info.description = "END";
        endState.info.lineOfCall = getLineOfCall();
        return this.sugarInfo.currentPointer();
    }

    registerContext(context) {
        this.context = context;
    }

    onPrompt(action) {
        if (!this.context) {
            throw new Error("Context not set");
        }
        if (!this.context.promptContains) {
            console.warn("Prompt not set. Setting default prompt");
            this.context.setPrompt();
        }
        const promptState = this.DoOn(this.context.promptContains, action, this.sugarInfo.currentPointer());
        promptState.info.description = "OnPROMPT";
        promptState.info.lineOfCall = getLineOfCall();
        return promptState;
    }

    write(data, {password = false, eol = null, on=null}={}) {
        if (!this.context) {
            throw new Error("Context not set");
        }
        const writeState = this.DoOn(on, () => {
            if (eol !== null) this.context.changeEOL(eol);
            let dataToWrite = data;
            if (typeof data === "function") {
                dataToWrite = data();  // call the function to get the data: supports dynamic data
            }
            this.context.write(dataToWrite, {password});
        });
        writeState.info.description = "WRITE";
        writeState.info.lineOfCall = getLineOfCall();
        return writeState;
    }

    writeOnPrompt(data, {password = false, eol = null}={}) {
        if (!this.context) {
            throw new Error("Context not set");
        }
        if (!this.context.promptContains) {
            console.warn("Prompt not set. Setting default prompt");
            this.context.setPrompt();
        }
        const writeState = this.write(data, {password, eol, on: this.context.promptContains});
        writeState.info.description = "WRITEOnPROMPT";
        writeState.info.lineOfCall = getLineOfCall();
        return writeState;
    }

    getInput() {
        if (!this.context) {
            throw new Error("Context not set");
        }
        if (!this.context.promptContains) {
            console.warn("Prompt not set. Setting default prompt");
            this.context.setPrompt();
        }
        const inputState = this.DoOn(this.context.promptContains, (data) => {
            return this.context.extractOutput(data.symbolText);
        });
        inputState.info.description = "GetINPUT";
        inputState.info.lineOfCall = getLineOfCall();
        return inputState;
    }

    wait(time) {
        const waitState = this.DoOn(null, async () => {

            if (!waitState.value) {
                console.log("Entered wait status when not waiting")
                // add a special "" transition to the head of its transition list
                waitState.transitionInputList.unshift("");
                const originalAcceptAllTransition = waitState.transitions[""];
                const bufferedData = [];
                console.log("Created bufferedData", bufferedData, bufferedData.length);
                waitState.transitions[""] = {
                    state: waitState, departAction: (data) => {
                        console.log("departAction: Buffering data", data, "to", bufferedData, bufferedData.length);
                        bufferedData.push(data.symbol);
                        console.log(bufferedData, bufferedData.length);
                    }, transitionInput: "", consumeInput: true
                };
                console.log("Set waitState value", new Date().toTimeString())
                waitState.value = new Promise((resolve) => {
                    console.log("In promise", new Date().toTimeString());
                    let waitTime = time;
                    if (typeof time === "function") {
                        waitTime = time();
                    }
                    console.log("Waiting for", time, "ms", new Date().toTimeString());
                    setTimeout(() => {
                        waitState.value = null;
                        console.log("Reset waitState value", new Date().toTimeString())
                        waitState.transitions[""] = originalAcceptAllTransition;
                        waitState.transitionInputList.shift();
                        console.log("All buffered data", bufferedData);
                        bufferedData.forEach((data) => {
                            console.log("Buffered data", data);
                            const event="null";
                            const arg={data: data.rawText, ansiOutputStream: data.ansiOutputStream};
                            const timestamp=data.time;
                            this.context.fakeEvent("script-stdout", event, arg, timestamp)
                        });
                        console.log("After buffered data", bufferedData);
                        resolve();
                    }, waitTime);
                });
                await waitState.value;
            } else {
                console.log("Entered wait status when waiting")

            }
        });
        waitState.info.description = "WAIT";
        waitState.info.lineOfCall = getLineOfCall();
        return waitState;
    }


}