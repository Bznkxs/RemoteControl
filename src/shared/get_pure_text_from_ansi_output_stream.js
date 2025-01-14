export function getPureTextFromAnsiOutputStream(ansiOutputStream) {
    const { outputSequence } = ansiOutputStream;
    return outputSequence.map(output => output.text).join("");
}