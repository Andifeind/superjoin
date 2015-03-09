/*!
 * Superjoin module loader
 * Copyright by Andi Heinkelein <andi.oxidant@noname-media.com>
 *
 * @module Superjoin
 */
(function(window) {
    'use strict';

    /**
     * Load a module
     *
     * Loads a local or npm module. If the module name starts with an . a local module will be loaded.
     * 
     * @param  {string} module Loads a module
     * @return {any}      Returns the loaded module.
     */
    var require = function(file) {

        if (require.alias && require.alias[file]) {
            file = require.alias[file];
        }

        var module = {
            exports: {},
            file: file
        };

        file = require.resolve(file, this ? this.file : null);

        if (window.require.cache[file]) {
            
            if (window.require.cache[file].obj) {
                return window.require.cache[file].obj;
            }

            window.require.cache[file].fn(module, module.exports, require.bind(module));
            window.require.cache[file].obj = module.exports;
            return window.require.cache[file].obj;
        }

        if (!window.require.autoload || file.charAt(0) !== '/') {
            throw new Error('Module ' + file + ' not found!');
        }

        var remoteFile = location.protocol
            .concat('//', location.host)
            .concat(file);
        
        var xhr = new XMLHttpRequest();
        xhr.open('GET', remoteFile, false);
        xhr.send();
        var source = xhr.responseText;

        var fn;
        try {
            //jshint evil:true
            fn = eval('(function(module, exports, require) {\n' + source + '\n})\n\n//# sourceURL=' + file);
        }
        catch (err) {
            throw new Error(err + ' in ' + file);
        }

        fn(module, module.exports, require.bind(module));
        window.require.cache[file] = {
            fn: fn,
            calls: 1,
            obj: module.exports,
            loaded: true
        };

        return window.require.cache[file].obj;
    };

    require.resolve = function(path, parent) {
        var resolved = [];
        if (path.charAt(0) === '.') {
            var newPath = parent || '.';
            newPath = newPath.split('/');
            newPath.pop();
            newPath = newPath.concat(path.split('/'));

            newPath.forEach(function(p) {
                if (p === '..') {
                    resolved.pop();
                    return;
                }
                else if (p === '.' || p === '') {
                    return;
                }

                resolved.push(p);
            });

            if (!parent ||parent.charAt(0) === '.') {
                resolved.unshift('.');
            }
        }
        else {
            return path;
        }

        resolved = resolved.join('/');
        if (!/\.js(on)?$/.test(resolved)) {
            resolved += '.js';
        }

        return resolved;
    };

    require.register = function(alias, path, fn) {
        if (arguments.length === 2) {
            fn = path;
            path = alias;
            alias= null;
        }

        require.cache[path] = {fn: fn, calls: 0};
        if (alias) {
            require.alias[alias] = path;
        }
    };

    require.cache = {};
    require.alias = {};

    window.require = require;
})(window);

