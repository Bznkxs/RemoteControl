export
function serializeObject(message) {
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'function') {
            return value.toString();
        } else {
            return value;
        }
    });
}


export
function deserializeObject(serialized) {
    return JSON.parse(serialized, (key, value) => {
        if (typeof value === 'string' && value.startsWith('function')) {
            return Function(`return ${value}`)();
        } else {
            return value;
        }
    });
}

export
function serializeFunction(func) {
    return func.toString();
}

export
function deserializeFunction(serialized) {
    return Function(`return ${serialized}`)();
}