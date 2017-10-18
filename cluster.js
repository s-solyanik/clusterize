;(function(name, definition) {
    if (typeof module != 'undefined') {
        module.exports = definition();
    }  else if (typeof define == 'function' && typeof define.amd == 'object') {
        define(definition);
    } else {
        this[name] = definition();
    };
}('Clusterize', function() {
    var Cluster,
        supportPageOffset = window.pageXOffset !== undefined,
        isCSS1Compat = ((document.compatMode || "") === "CSS1Compat");

    function isUndefined(value) {
        return value === void 0;
    }

    function isString(value) {
        return Object.prototype.toString.call(value) === '[object String]';
    }

    function debounce(func, wait, immediate) {
        var timeout;
        
        return function() {
            var context = this,
                args = arguments,
                later = function() {
                    timeout = null;
                    if (!immediate) {
                        func.apply(context, args)
                    };
                };

            var callNow = immediate && !timeout;

            clearTimeout(timeout);
            timeout = setTimeout(later, wait);

            if (callNow) {
                func.apply(context, args)
            };
        };
    }

    function render(data, callback) {
        if(Array.isArray(data)) {
            return data.reduce(function (str, data) {
                str +=render(data, callback);
                return str;
            }, '');
        }
        return callback(data).outerHTML;
    }
    
    function getScroll(){
        return supportPageOffset
            ? window.pageYOffset
            : isCSS1Compat
                ? document.documentElement.scrollTop
                : document.body.scrollTop;
    }

    function flatArray(data) {
        return (data || []).reduce(function (array, data) {
            return array.concat(data);
        }, []);
    }

    function setHeight(node, height) {
        node.style.height = height ? `${height}px` : 'auto';
        return this;
    }

    var DEFAULT_SETTINGS = {
            inRow: 1,
            size: 10,
            visible: 50
        },
        DEFAULT_OPTIONS = {
            tag: 'li'
        };

    Cluster = function (settings, data) {
        this.setSettings(settings);
        this.add(data || []);
        this.cache = {};
    }

    Cluster.prototype.add = function (method, items, settings) {

        if (!isString(method)) {
            items = method;
        }

        this.setSettings(settings);

        var data = [].concat(items);
            matrix = this.createMatrix(data, this.settings.inRow || DEFAULT_ROW);

        if (method === 'prepend') {
            this.cluster = matrix.concat(this.cluster || []);
        } else {
            this.cluster = (this.cluster || []).concat(matrix);
        }

        this.size = this.cluster.length * this.settings.size;
    }

    Cluster.prototype.setSettings = function (settings) {
        this.settings = Object.assign(this.settings || DEFAULT_SETTINGS, settings || {});
    }

    Cluster.prototype.clear = function (settings) {
        this.cluster = [];
        this.size = 0;
        this.cache = {};
    }

    Cluster.prototype.createMatrix = function (array, elementsPerSubArray) {
        var k = -1;

        return array.reduce(function (matrix, unit, index) {
            if (index % elementsPerSubArray === 0) {
                k++;
                matrix[k] = [];
            }

            matrix[k].push(array[index]);

            return matrix;
        }, []);
    }

    Cluster.prototype.generate = function (offset) {
        var settings = this.settings,
            len = this.cluster.length;

        if (len < settings.inRow) {
            return {
                top: 0,
                bottom: 0,
                rowsAbove: 0,
                rows: len ? this.cluster : []
            }
        }

        var itemsStart = Math.floor(Math.max(offset/settings.size, 0)),
            itemsEnd = Math.floor(itemsStart + settings.visible),
            top = Math.max(itemsStart * settings.size, 0),
            bottom = Math.max((len - itemsEnd) * settings.size, 0),
            currentRows = [],
            rowsAbove = itemsStart;

        if(top < 1) {
            rowsAbove++;
        }

        for (var i = itemsStart; i < itemsEnd; i++) {
            this.cluster[i] && currentRows.push(this.cluster[i]);
        }

        return {
            top: top,
            bottom: bottom,
            rowsAbove: rowsAbove,
            rows: currentRows
        }
    };

    Cluster.prototype.checkChanges = function (type, value) {
        var changed = false;

        if (Array.isArray(value)) {
            changed =  flatArray(value).join() != flatArray(this.cache[type]).join();
        } else {
            changed =  value != this.cache[type];
        }

        this.cache[type] = value;
        return changed;
    }

    Constructor = function (container, settings, data) {
        this.container = container;
        this.cluster = new Cluster(settings, data);
        this.options = Object.assign(DEFAULT_OPTIONS, settings)

        this.render();

        window.addEventListener('scroll', this.render.bind(this), false)
    }

    Constructor.prototype = {
        constructor: Constructor,
        render: function () {
            var layout = [],
                scroll = getScroll(),
                data = this.cluster.generate(scroll),
                isClusterUpdated = this.cluster.checkChanges('data', data.rows),
                isTopUpdated = this.cluster.checkChanges('top', data.top),
                isBottomUpdated = this.cluster.checkChanges('bottom', data.bottom);

            if (isClusterUpdated || isTopUpdated) {
                if (isTopUpdated) {
                    layout.push(this.compensator('before', data.top).outerHTML);
                }

                layout.push(this.layout(data.rows));

                if (isBottomUpdated) {
                    this.after = this.compensator('after', data.bottom);
                    layout.push(this.after.outerHTML);
                }

                this.container.innerHTML = layout.join('');
                setHeight(this.container, this.cluster.size);
            } else if(isBottomUpdated && this.after) {
                this.after.style.height = `${data.bottom}px`;
            }
        },

        update: function () {
            this.cluster.add.apply(this.cluster, arguments);
        },

        destroy: function () {
            this.cluster.clear();
            this.after = null;
            window.removeEventListener('scroll', this._run, false)
        },

        layout: function (data) {
            return data.reduce(function (str, data) {
                str +=render(data, this.createTag.bind(this));
                return str;
            }.bind(this), '');
        },

        compensator: function (name, height) {
            var node = this.createTag(null, name);

            setHeight(node, height);

            return node;
        },

        createTag: function (text, className) {
            var tag = document.createElement(this.options.tag);

            if (className) {
                tag.classList.add(className);
            }

            tag.appendChild(document.createTextNode(isUndefined(text) || text === null ? '' : text));

            return tag;
        }
    }

    return Constructor;
}));