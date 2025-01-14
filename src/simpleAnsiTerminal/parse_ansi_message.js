

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

export function getStyles(num, gb, fullwidth) {

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

// module.exports = {getStyles};