var Tools = {
    /* Manager the file */
    getModuleFs: () => {
        return require('fs') || {};
    },
    /* Check if the variable exists */
    isset: obj => {
        return obj !== undefined ? true : false;
    },
    /* Get the variable's type */
    type: (obj, simple) => {
        var regex, temp;
        if (Tools.isset(obj)) {
            if (Tools.isset(simple) && simple) {
                return typeof obj;
            } else if (obj != null) {
                if (obj.constructor.name == undefined) {
                    regex = /function ([^(]+)\([^)]*\)[^{]*\{[^}]*\}/;
                    temp = obj.constructor.toString().match(regex);
                    if (temp == null) {
                        regex = /\[object ([^\]]+)\]/;
                        temp = obj.constructor.toString().match(regex);
                    }
                    obj.constructor.name = temp != null ? temp[1] : 'Object';
                }
                return obj.constructor.name;
            }
        }
        return false;
    },
    /* Check the type */
    istype: (obj, type, simple) => {
        if (Tools.isset(obj)) {
            if (Tools.isset(simple) && simple) {
                return Tools.type(obj, simple) == type;
            } else {
                return Tools.type(obj) == type;
            }
        } else {
            return false;
        }
    },
    /* JSON string to object */
    jsonParse: content => {
        try {
            return JSON.parse(content);
        } catch (e) {
            return {};
        }
    },
    /* Get a random number */
    randInt: (a, b) => {
        return Math.floor(Math.random() * (b - a)) + a;
    },
    /* Get a random string */
    alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    randChars: (n, letters) => {
        var o = '';
        n = n >> 0 || 1;
        letters = letters || Tools.alpha;
        while (n--) {
            o += letters[Tools.randInt(0, letters.length)];
        }
        return o;
    },
    /* Search with a regex */
    match: (regex, content) => {
        return new RegExp(regex).exec(content);
    },
    /* Is it an email ? */
    testEmail: arg => {
        return (
            Tools.match(
                [
                    '^(([^<>()\\[\\]\\.,;:\\s@\\"\\\']+(\\.[^<>()\\[\\]\\.,;:\\s@\\"\\\']+)*)',
                    '|(\\".+\\"))@(([^<>()\\.,;\\s@\\"\\\']+\\.{0,1})+([^<>()\\.,;:\\s',
                    '@\\"\\\']{2,}|[\\d\\.]+))$'
                ].join(''),
                arg
            ) !== null
        );
    },
    /* Base64: Encode / Decode */
    b64alpha:
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    b64encode: c => {
        var o, r, a, l, i, t;
        for (
            a = Tools.b64alpha, o = '', r = 0, i = 0;
            ((l = c.charCodeAt(i)), l >= 0) ||
            ((l = 0), c[i - 1] && i % 3) ||
            ((a = '='), (r = l = 0), o.length % 4);
            !(i % 3) && c[i - 1] ? ((o += a[r]), (r = 0)) : 1
        ) {
            (t = ((i % 3) + 1) * 2),
            (o += a[r + (l >> t)]),
            (r = (l - ((l >> t) << t)) << (6 - t)),
            i++;
        }
        return o;
    },
    b64decode: c => {
        var o, r, a, l, i, t;
        for (
            a = Tools.b64alpha, o = '', r = 0, i = 0;
            (l = a.indexOf(c[i])), l >= 0;
            i++
        ) {
            (t = (6 - (i % 4) * 2) % 6),
            i % 4
                ? ((o += String.fromCharCode(r + (l >> t))),
                (r = (l - ((l >> t) << t)) << (8 - t)))
                : (r = l << 2);
        }
        return o;
    }
};

module.exports = Tools;
