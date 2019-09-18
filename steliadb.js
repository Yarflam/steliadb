const uniqid = require('uniqid');
const tools = require('./tools');

/* Private Methods -> token */
const PRIVATE_READ_TOKEN = tools.randChars(32);
const PRIVATE_WRITE_TOKEN = tools.randChars(32);

module.exports = class SteliaDb {
    constructor() {
        /* Default dbStore */
        this.dbUse = null;
        this.dbIndex = {};
        this.dbStore = {};
        /* Default parameters */
        this.default = {
            find: {
                search: {},
                options: {
                    limit: 10,
                    deleteMany: false
                }
            }
        };
        /* Cache */
        this.handleCache = null;
        this.limitCache = 100;
        this.counterCache = 0;
        this.bsonMaxSize = 1024 * 1024 * 1024;
    }

    /*
     *	Database
     */

    use(path) {
        /* Set a new path */
        this.dbUse = path;
        /* Create the default file */
        const fs = require('fs');
        if (fs.existsSync(path)) {
            try {
                /* Use BSON format */
                const bson = require('bson');
                bson.setInternalBufferSize(this.bsonMaxSize);
                /* Deserialize */
                const data = bson.deserialize(fs.readFileSync(path));
                if (tools.istype(data, 'Object')) {
                    this.dbStore = data;
                    /* Regenerate the index */
                    this.dbIndex = Object.entries(this.dbStore)
                        .map(([name, docs] = _) => {
                            return [
                                name,
                                docs
                                    .map(doc => {
                                        return [doc._id, doc.id];
                                    })
                                    .reduce(
                                        (accum, [_id, id] = _) => {
                                            accum._id.push(_id);
                                            accum.id = Math.max(
                                                accum.id,
                                                id + 1
                                            );
                                            return accum;
                                        },
                                        { _id: [], id: 1 }
                                    )
                            ];
                        })
                        .reduce((accum, [name, doc] = _) => {
                            accum[name] = doc;
                            return accum;
                        }, {});
                }
            } catch (e) {}
        } else {
            this.save();
        }
        /* Call the cache system */
        this.cache();
        return this;
    }

    save() {
        if (this.dbUse !== null) {
            const fs = require('fs');
            /* Use BSON format */
            const bson = require('bson');
            bson.setInternalBufferSize(this.bsonMaxSize);
            /* Write all data */
            fs.writeFileSync(this.dbUse + '.1', bson.serialize(this.dbStore));
            /* Move on */
            if (fs.existsSync(this.dbUse)) {
                fs.unlinkSync(this.dbUse);
            }
            fs.renameSync(this.dbUse + '.1', this.dbUse);
            /* Reset the cache */
            return this.cache(true);
        }
        return false;
    }

    cache(action, data) {
        if (this.dbUse === null) {
            return;
        }
        /* Load/Save/Reset caches */
        const fs = require('fs');
        if (this.handleCache === null) {
            /* A cache exists */
            if (fs.existsSync(this.dbUse + '.tmp')) {
                var ref;
                /* Replay the calls */
                fs.readFileSync(this.dbUse + '.tmp')
                    .toString()
                    .split('\n')
                    .map(row => {
                        /* Continue */
                        if (!row.length || row.indexOf(':') < 0) {
                            return;
                        }
                        /* Action + Data */
                        [action, data] = row.split(':');
                        data = tools.jsonParse(tools.b64decode(data));
                        if (
                            !(
                                tools.isset(data.model) &&
                                tools.istype(data.model, 'String') &&
                                (action == 'drop' ||
                                    (tools.isset(data.doc) &&
                                        tools.istype(data.doc, 'Object')))
                            )
                        ) {
                            return;
                        }
                        /* Prepare the collection */
                        this.build(data.model);
                        /* Insert */
                        if (action == 'insert') {
                            this.dbIndex[data.model]._id.push(
                                data.doc._id || uniqid()
                            );
                            this.dbIndex[data.model].id = Math.max(
                                this.dbIndex[data.model].id,
                                data.doc.id + 1
                            );
                            this.dbStore[data.model].push(data.doc);
                        }
                        /* Update */
                        if (action == 'update') {
                            ref = this.dbIndex[data.model]._id.indexOf(
                                data.doc._id || ''
                            );
                            if (ref >= 0) {
                                this.dbStore[data.model][ref] = data.doc;
                            }
                        }
                        /* Remove */
                        if (action == 'remove') {
                            ref = this.dbIndex[data.model]._id.indexOf(
                                data.doc._id || ''
                            );
                            if (ref >= 0) {
                                this.dbIndex[data.model]._id.splice(ref, 1);
                                this.dbStore[data.model].splice(ref, 1);
                            }
                        }
                        /* Drop */
                        if (action == 'drop') {
                            if (data.model == '*') {
                                this.dbIndex = {};
                                this.dbStore = {};
                            } else {
                                delete this.dbIndex[data.model];
                                delete this.dbStore[data.model];
                            }
                        }
                    });
            }
            /* Start the handle */
            this.handleCache = fs.createWriteStream(this.dbUse + '.tmp');
            this.counterCache = 0;
            /* Save */
            this.save();
            return true;
        } else if ((action || false) && (data || false)) {
            if (['insert', 'update', 'remove', 'drop'].indexOf(action) >= 0) {
                /* Save the data in the cache */
                this.handleCache.write(
                    action + ':' + tools.b64encode(JSON.stringify(data)) + '\n'
                );
                this.counterCache++;
                /* Apply */
                if (this.counterCache >= this.limitCache) {
                    this.save();
                }
                return true;
            }
        } else if ((action || false) === true) {
            /* Remove the older */
            if (this.handleCache !== null) {
                this.handleCache.close();
                fs.unlinkSync(this.dbUse + '.tmp');
            }
            /* Reset the handle */
            this.handleCache = fs.createWriteStream(this.dbUse + '.tmp');
            this.counterCache = 0;
            return true;
        }
        return false;
    }

    /*
     *	Collections
     */

    build(name) {
        /* Not empty */
        if (
            !(tools.isset(name) && tools.istype(name, 'String') && name.length)
        ) {
            return false;
        }
        /* Create an index */
        if (!tools.isset(this.dbIndex[name])) {
            this.dbIndex[name] = {
                _id: [],
                id: 1
            };
        }
        /* Create a store */
        if (!tools.isset(this.dbStore[name])) {
            this.dbStore[name] = [];
        }
        return true;
    }

    getCollection(model) {
        /* Verify the model */
        if (
            !(
                tools.isset(model) &&
                tools.istype(model, 'Object') &&
                tools.isset(model.name) &&
                tools.isset(model.struct) &&
                tools.istype(model.name, 'String') &&
                tools.istype(model.struct, 'Object')
            )
        ) {
            return;
        }
        /* Prepare */
        this.build(model.name);
        /* Assign the route */
        [
            'insert',
            'update',
            'find',
            'findSync',
            'mapReduce',
            'mapReduceSync',
            'remove',
            'drop'
        ].map(method => {
            model.struct['id'] = { type: 'int' };
            model[method] = (...args) => {
                return this['_' + method](PRIVATE_READ_TOKEN, model, args);
            };
        });
        return model;
    }

    show() {
        return Object.keys(this.dbStore);
    }

    drop(accept) {
        if ((accept || false) === true) {
            this.dbIndex = {};
            this.dbStore = {};
            /* Add an entry in the cache */
            this.cache('drop', { model: '*' });
            return true;
        }
        return false;
    }

    /*
     *	Write
     */

    _insert(token, model, args) {
        /* Security */
        if (!this._secureReadToken(token) || !tools.istype(args, 'Array')) {
            return false;
        }
        /* After a drop */
        this.build(model.name || '');
        /* Each document */
        args.map(doc => {
            if (!tools.istype(doc, 'Object')) {
                return;
            }
            /* Clean up and securize the data */
            doc = Object.entries(this._flatDeepObj(doc))
                .map(([key, value] = _) => {
                    if (this._getDeepProp(model.struct, key) !== null) {
                        return [
                            key,
                            this._secureData(
                                value,
                                this._getDeepProp(model.struct, key).type ||
                                    false
                            )
                        ];
                    }
                })
                .filter(keyValue => {
                    return tools.isset(keyValue) && keyValue[0] != '_id';
                })
                .reduce((accum, [key, value]) => {
                    this._setDeepProp(accum, key, value);
                    return accum;
                }, {});
            /* Add an ID */
            doc['_id'] = uniqid();
            doc['id'] = this.dbIndex[model.name].id++;
            this.dbIndex[model.name]._id.push(doc['_id']);
            /* Insert my new document */
            if (!tools.isset(this.dbStore[model.name])) {
                this.dbStore[model.name] = [doc];
            } else {
                this.dbStore[model.name].push(doc);
            }
            /* Add an entry in the cache */
            this.cache('insert', {
                model: model.name,
                doc
            });
        });
        return true;
    }

    _update(token, model, args) {
        args = args || [];
        var search = args[0] || this.default.find.search,
            modifier = args[1] || {};
        /* Security */
        if (!this._secureReadToken(token)) {
            return false;
        }
        /* Execute find method */
        var docs,
            proc = this._find(token, model, [
                search,
                { limit: 100 },
                PRIVATE_WRITE_TOKEN
            ]);
        while ((docs = proc.next().value)) {
            docs.map(doc => {
                /* SET */
                if (tools.isset(modifier.$set)) {
                    Object.entries(modifier.$set).map(([key, value] = _) => {
                        if (
                            key != '_id' &&
                            key != 'id' &&
                            this._getDeepProp(model.struct, key) !== null
                        ) {
                            this._setDeepProp(
                                doc,
                                key,
                                this._secureData(
                                    value,
                                    this._getDeepProp(model.struct, key).type ||
                                        false
                                )
                            );
                        }
                    });
                }
                /* UNSET */
                if (tools.isset(modifier.$unset)) {
                    Object.entries(modifier.$unset).map(([key, value] = _) => {
                        if (
                            key != '_id' &&
                            key != 'id' &&
                            this._getDeepProp(model.struct, key)
                        ) {
                            /* Null : delete the property */
                            this._setDeepProp(doc, key, null);
                        }
                    });
                }
                /* RENAME */
                if (tools.isset(modifier.$rename)) {
                    Object.entries(modifier.$rename).map(([key, value] = _) => {
                        if (
                            key != '_id' &&
                            key != 'id' &&
                            tools.isset(doc[key]) &&
                            this._getDeepProp(model.struct, key) !== null
                        ) {
                            /* Copy the values in another property */
                            this._setDeepProp(
                                doc,
                                value,
                                this._secureData(
                                    doc[key],
                                    this._getDeepProp(model.struct, key).type ||
                                        false
                                )
                            );
                            /* Null : delete the old property */
                            this._setDeepProp(doc, key, null);
                        }
                    });
                }
                /* CURRENT DATE */
                if (tools.isset(modifier.$currentDate)) {
                    Object.keys(modifier.$currentDate).map(key => {
                        if (this._getDeepProp(model.struct, key) !== null) {
                            /* Assign */
                            this._setDeepProp(
                                doc,
                                key,
                                this._secureData(
                                    new Date().toISOString(),
                                    this._getDeepProp(model.struct, key).type ||
                                        false
                                )
                            );
                        }
                    });
                }
                /* Add an entry in the cache */
                this.cache('update', {
                    model: model.name,
                    doc
                });
            });
        }
        return true;
    }

    _remove(token, model, args) {
        var ref,
            docs,
            search = args[0] || this.default.find.search,
            options = args[1] || this.default.find.options,
            deleteMany = options.deleteMany || false;
        /* Security */
        if (!this._secureReadToken(token)) {
            return false;
        }
        /* Execute find method */
        docs = this._findSync(token, model, [
            search,
            { limit: 100, '_id.$': 1 }
        ]);
        if (!deleteMany && docs.length) {
            docs = docs.slice(0, 1);
        }
        /* Remove the documents */
        docs.map(({ _id }) => {
            ref = this.dbIndex[model.name]._id.indexOf(_id);
            if (ref >= 0 && tools.isset(this.dbStore[model.name][ref])) {
                this.dbIndex[model.name]._id.splice(ref, 1);
                this.dbStore[model.name].splice(ref, 1);
                /* Add an entry in the cache */
                this.cache('remove', {
                    model: model.name,
                    doc: { _id }
                });
            }
        });
        return true;
    }

    _drop(token, model, args) {
        /* Security */
        if (!this._secureReadToken(token)) {
            return false;
        }
        /* Remove the data */
        if (
            (args[0] || false) === true &&
            tools.isset(this.dbIndex[model.name]) &&
            tools.isset(this.dbStore[model.name])
        ) {
            delete this.dbIndex[model.name];
            delete this.dbStore[model.name];
            /* Add an entry in the cache */
            this.cache('drop', { model: model.name });
            return true;
        }
        return false;
    }

    /*
     *	Read
     */

    _find(token, model, args) {
        args = args || [];
        var test,
            docs,
            projection,
            search = args[0] || this.default.find.search,
            options = args[1] || this.default.find.options,
            writeToken = args[2] || 0;
        /* Security */
        if (!this._secureReadToken(token)) {
            return false;
        }
        writeToken = this._secureWriteToken(token, writeToken);
        /* Correct request */
        if (!tools.istype(search, 'Object')) {
            search = this.default.find.search;
        }
        if (!tools.istype(options, 'Object')) {
            options = this.default.find.options;
        }
        options.limit = options.limit || 10;
        /* Projection */
        projection = Object.entries(options)
            .filter(([key, value] = _) => {
                return value && key.match(new RegExp('\\.\\$$'));
            })
            .map(([key, value] = _) => {
                return key.slice(0, -2);
            });
        if (projection.length && projection.indexOf('_id') < 0) {
            projection.push('_id');
        }
        /* Sort */
        docs = this.dbStore[model.name] || [];
        docs = tools.isset(options.$sort)
            ? this._quickSortDocs(docs, options.$sort)
            : docs;
        /* Declare a generator */
        var self = this,
            gen = {
                i: 0,
                doc: null,
                results: [],
                init: function*() {
                    while (this.i < docs.length) {
                        this.doc = docs[this.i];
                        /* Checker */
                        test = Object.entries(search).map(([key, cdt] = _) => {
                            if (self._getDeepProp(model.struct, key) !== null) {
                                return self._conditions(
                                    self._getDeepProp(this.doc, key),
                                    cdt
                                );
                            }
                            return 0;
                        });
                        /* Add */
                        if (Math.min(...test)) {
                            if (writeToken && !projection.length) {
                                this.results.push(this.doc);
                            } else if (!projection.length) {
                                this.results.push({ ...this.doc });
                            } else {
                                this.results.push(
                                    self._extFlatObj(
                                        Object.entries(
                                            self._flatDeepObj(this.doc)
                                        )
                                            .filter(([key, value] = _) => {
                                                return (
                                                    projection.indexOf(key) >= 0
                                                );
                                            })
                                            .reduce(
                                                (accum, [key, value] = _) => {
                                                    accum[key] = value;
                                                    return accum;
                                                },
                                                {}
                                            )
                                    )
                                );
                            }
                        }
                        /* Continue or stop */
                        if (
                            (options.limit || false) &&
                            this.results.length >= options.limit &&
                            this.i + 1 < docs.length
                        ) {
                            yield this.results;
                            this.results = [];
                        }
                        /* Routine */
                        this.i++;
                    }
                    if (this.results.length) {
                        yield this.results;
                    }
                }
            };
        return gen.init();
    }

    _findSync(token, model, args) {
        var docs,
            proc,
            output = [],
            search = args[0] || this.default.find.search,
            options = args[1] || this.default.find.options;
        /* Security */
        if (!this._secureReadToken(token)) {
            return false;
        }
        /* Treatment */
        options.limit = 100;
        proc = this._find(token, model, [search, options]);
        while ((docs = proc.next().value)) {
            output = output.concat(docs);
        }
        return output;
    }

    _mapReduce(token, model, args) {
        return new Promise((resolve, reject) => {
            const results = this._mapReduceSync(token, model, args);
            if (results) {
                resolve(results);
            } else {
                reject();
            }
        });
    }

    _mapReduceSync(token, model, args) {
        /* Security */
        if (!this._secureReadToken(token)) {
            return false;
        }
        /* Map Reduce - checking */
        if (
            tools.isset(args[0]) &&
            tools.isset(args[1]) &&
            tools.istype(args[0], 'Function') &&
            tools.istype(args[1], 'Function')
        ) {
            /* Define the process */
            var docs,
                proc,
                reduceOutput,
                mapOutput = {},
                emit = (key, value) => {
                    if (!tools.isset(mapOutput[key])) {
                        mapOutput[key] = [];
                    }
                    mapOutput[key].push(value);
                };
            /* Prepare the functions */
            var mapFct = new Function(
                    'var emit=this.emit;(' +
                        args[0]
                            .toString()
                            .replace(
                                new RegExp('^\\(([^)]*)\\)[^=]*=>'),
                                'function($1)'
                            ) +
                        ').bind(this.doc)()'
                ),
                reduceFct = args[1];
            /* Execute the Map */
            proc = this._find(token, model, [
                args[2] || this.default.find.search,
                { limit: 100 }
            ]);
            while ((docs = proc.next().value)) {
                docs.map(doc => {
                    mapFct.bind({ emit, doc })();
                });
            }
            /* Execute the Reduce */
            reduceOutput = Object.entries(mapOutput)
                .map(([key, values] = _) => {
                    return [key, reduceFct(key, values)];
                })
                .reduce((accum, [key, value]) => {
                    this._setDeepProp(accum, key, value);
                    return accum;
                }, {});
            return reduceOutput;
        }
        return false;
    }

    /*
     *	Tools
     */

    /* Flatten a deep object */
    _flatDeepObj(obj) {
        var i = 0,
            flatObj = {},
            indexLayer = [],
            dataLayer = [];
        /* Obviously, require an object */
        if (tools.istype(obj, 'Object')) {
            /* Create two layers : indexes and data storage */
            indexLayer = Object.keys(obj);
            dataLayer = Object.values(obj);
            /* Loop on the indexes */
            while (i < indexLayer.length) {
                /* Is an object */
                if (tools.istype(dataLayer[i], 'Object')) {
                    /* Add it */
                    indexLayer = indexLayer.concat(
                        Object.keys(dataLayer[i]).map(function(key) {
                            return [indexLayer[i], key].join('.');
                        })
                    );
                    dataLayer = dataLayer.concat(Object.values(dataLayer[i]));
                } else {
                    /* Register in the flat object */
                    flatObj[indexLayer[i]] = dataLayer[i];
                }
                /* Next index */
                i++;
            }
        }
        return flatObj;
    }

    /* Extrude a flat object */
    _extFlatObj(flatObj) {
        var obj = {};
        Object.entries(flatObj).map(([key, value] = _) => {
            this._setDeepProp(obj, key, value);
        });
        return obj;
    }

    /* Get a specific property in a deep object */
    _getDeepProp(obj, path) {
        /* Arguments */
        obj = tools.isset(obj) && tools.istype(obj, 'Object') ? obj : {};
        /* Explore */
        return (path || '')
            .split('.')
            .map(key => {
                if (tools.isset(obj[key])) {
                    /* Walk */
                    obj = obj[key];
                    return obj;
                } else {
                    return null;
                }
            })
            .pop();
    }

    /* Set a specific property in a deep object */
    _setDeepProp(obj, path, value) {
        /* Arguments */
        obj = tools.isset(obj) && tools.istype(obj, 'Object') ? obj : {};
        path = (path || '').split('.');
        /* Explore */
        path.map((key, index) => {
            if (index < path.length - 1) {
                /* Create a branch */
                if (!tools.isset(obj[key])) {
                    obj[key] = {};
                }
                /* Walk */
                obj = obj[key];
            } else {
                if (value === null) {
                    /* Delete */
                    delete obj[key];
                } else {
                    /* Write the value */
                    obj[key] = value;
                }
            }
            return obj;
        });
    }

    /* Comparisons Operator */
    _conditions(value, cdt, mode) {
        mode = mode == 'OR' ? 'OR' : 'AND';
        if (Array.isArray(cdt)) {
            return cdt
                .map(cdtItem => {
                    return this._conditions(value, cdtItem, mode);
                })
                .reduce((accum, op) => {
                    return mode == 'OR' ? accum || op : accum && op;
                });
        } else {
            var test = [],
                found = 0;
            if (tools.isset(cdt.$exists)) {
                test.push(
                    ((cdt.$exists && value !== null) ||
                        (!cdt.$exists && value === null)) >> 0
                );
            }
            if (tools.isset(cdt.$regex)) {
                var regex = new RegExp(String(cdt.$regex));
                test.push((String(value).match(regex) !== null) >> 0);
            }
            if (tools.isset(cdt.$lt)) {
                test.push((value < cdt.$lt) >> 0);
            }
            if (tools.isset(cdt.$lte)) {
                test.push((value <= cdt.$lte) >> 0);
            }
            if (tools.isset(cdt.$gt)) {
                test.push((value > cdt.$gt) >> 0);
            }
            if (tools.isset(cdt.$gte)) {
                test.push((value >= cdt.$gte) >> 0);
            }
            if (tools.isset(cdt.$in)) {
                test.push((cdt.$in.indexOf(value) >= 0) >> 0);
            }
            if (tools.isset(cdt.$nin)) {
                test.push((cdt.$nin.indexOf(value) < 0) >> 0);
            }
            if (tools.isset(cdt.$or) && Array.isArray(cdt.$or)) {
                test.push(this._conditions(value, cdt.$or, 'OR') >> 0);
            }
            if (tools.isset(cdt.$ne)) {
                test.push((value != cdt.$ne) >> 0);
            }
            if (tools.isset(cdt.$eq) || !test.length) {
                test.push((value == (cdt.$eq || cdt)) >> 0);
            }
            return test.reduce((accum, op) => {
                return accum && op;
            });
        }
    }

    /* Apply quicksort algorithm on documents */
    _quickSortDocs(table, options) {
        var i,
            c = {},
            pivot = null,
            left = [],
            right = [];
        if (!table.length) {
            return table;
        }
        for (i = 0; i < table.length; i++) {
            if (i) {
                if (
                    ((a, b) => {
                        return Object.entries(options)
                            .map(([key, order] = _) => {
                                /* Bayesian Mind */
                                [c.sign, c.order] = [
                                    order > 0 ? 1 : -1,
                                    Math.abs(order) <= 1 ? Math.abs(order) : 1
                                ];
                                c.order =
                                    c.sign *
                                    (Math.random() * (1 - c.order) + c.order);
                                /* Get the value */
                                c.a = this._getDeepProp(a, key) || 0;
                                c.b = this._getDeepProp(b, key) || 0;
                                /* Compare */
                                return c.a == c.b
                                    ? 0
                                    : c.a > c.b
                                    ? -c.order
                                    : c.order;
                            })
                            .reduce((accum, x) => {
                                return accum + x;
                            }, 0);
                    })(table[pivot], table[i]) < 0
                ) {
                    left.push(table[i]);
                } else {
                    right.push(table[i]);
                }
            } else {
                pivot = i;
            }
        }
        /* Next Steps */
        left = this._quickSortDocs(left, options);
        right = this._quickSortDocs(right, options);
        /* Compile */
        return left.concat([table[pivot]], right);
    }

    /* Security */

    _secureReadToken(token) {
        return PRIVATE_READ_TOKEN == token;
    }

    _secureWriteToken(readToken, writeToken) {
        return (
            this._secureReadToken(readToken) &&
            PRIVATE_WRITE_TOKEN == writeToken
        );
    }

    _secureData(value, itemType) {
        switch (itemType) {
            case 'varchar':
                value = String(value);
                break;
            case 'int':
                value = Math.floor(Number(value));
                value = !isNaN(value) ? value : 0;
                break;
            case 'float':
                value = Number(value);
                value = !isNaN(value) ? value : 0;
                break;
            case 'email':
                value = tools.testEmail(value) ? value : null;
                break;
            case 'timestamp':
                value = String(value);
                if (
                    !value.match(
                        /* ISO 8601 - JS Date : YYYY-MM-DD\THH:MM:SS\.MLS\Z */
                        new RegExp(
                            [
                                /* YYYY-MM-DD (T) - Date */
                                '^[0-9]{4}-[0-9]{2}-[0-9]{2}T',
                                /* HH:MM:SS (.) - Time */
                                '[0-9]{2}:[0-9]{2}:[0-9]{2}\\.',
                                /* MLS (Z) - Milliseconds, Timezone */
                                '[0-9]{3}Z$'
                            ].join('')
                        )
                    )
                ) {
                    value = '';
                }
                break;
            case 'array':
                value = Array.isArray(value) ? value : [];
                break;
            default:
                value = null;
                break;
        }
        return value;
    }
};
