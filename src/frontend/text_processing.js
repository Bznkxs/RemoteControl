export
function dataContains(data, contains) {
    if (!contains) return true;  // if contains is null or undefined, then it is always true
    // deal with situations where data does not need to be String
    if (data && data.text) {
        data = data.text;
    }
    if (contains instanceof Array) {
        let returnVal = true;
        for (let i = 0; i < contains.length; i++) {
            returnVal = returnVal && dataContains(data, contains[i]);
        }
        return returnVal;
    }
    if (contains instanceof Function) {
        return contains(data);
    }
    // deal with situations where data needs to be String
    if (data === null || data === undefined) return false;
    if (typeof contains === "string") {
        return data.includes(contains);
    }
    if (contains instanceof RegExp) {
        console.log("RegExp:", contains, "Data:", data, "Result:", contains.test(data));
        return contains.test(data);
    }

    throw new Error("Invalid type for contains");
}