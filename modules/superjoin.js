/**
 * Superjoin module
 *
 * @module Superjoin
 */
'use strict';

var path = require('path');

var TaskRunner = require('co-tasks');
var fl = require('node-fl');
var log = require('logtopus');

log.setLevel('warn');

/**
 * Superjoin class
 *
 * @constructor
 */
class Superjoin extends TaskRunner {
    constructor(conf) {
        super();
        conf = conf || {};

        if (conf.verbose) {
            log.setLevel('debug');
        }

        this.fileCache = {};
        this.scripts = [];
        this.modules = [];
        this.rcalls = [];

        this.defineTasks(['init', 'configure', 'collect', 'build', 'write', 'clean']);
        this.registerTask('configure', this.configureTask.bind(this, conf));
        this.registerTask('collect', this.collectTask.bind(this, conf));
        this.registerTask('build', this.buildTask.bind(this));
        this.registerTask('write', this.writeTask.bind(this));
    }

    configureTask(conf) {
        var promise = new Promise(function(resolve, reject) {
            this.workingDir = conf.workingDir || process.cwd();

            this.confFiles = conf.confFiles || null;
            if (!this.confFiles) {
                this.confFiles = [
                    path.join(this.workingDir, 'superjoin.json'),
                    path.join(this.workingDir, 'package.json')
                ];
            }

            var sjConf = this.readConfFile(this.confFiles);

            this.root = conf.root || sjConf.root || this.workingDir;
            this.umd = conf.umd || sjConf.umd || false;
            this.umdDependencies = conf.umdDependencies || sjConf.umdDependencies || false;
            this.skipSubmodules = conf.skipSubmodules || sjConf.skipSubmodules || false;
            this.outfile = conf.outfile || sjConf.outfile || null;
            this.dev = conf.dev || sjConf.dev || null;
            this.main = conf.main || sjConf.main || null;
            this.name = conf.name || sjConf.name || null;
            this.banner = conf.banner || null;

            if (conf.files && conf.files.length > 0) {
                this.files = conf.files;
            }
            else {
                this.files = sjConf.files;
            }

            if (this.root && this.root.charAt(0) !== '/') {
                this.root = path.join(this.workingDir, this.root);
            }

            if (this.outfile && this.outfile.charAt(0) !== '/') {
                this.outfile = path.join(this.root, this.outfile);
            }

            this.libDir = conf.libDir || sjConf.libDir || null;
            if (this.libDir && this.libDir.charAt(0) !== '/') {
                this.libDir = path.join(this.root, this.libDir);
            }

            this.bwrDir = conf.bwrDir || sjConf.bwrDir || null;
            if (this.bwrDir && this.bwrDir.charAt(0) !== '/') {
                this.bwrDir = path.join(this.workingDir, this.bwrDir);
            }
            else {
                let dir = path.join(this.workingDir, 'bower_components');
                while (true) {
                    if (fl.exists(dir)) {
                        this.bwrDir = dir;
                        break;
                    }

                    dir = path.join(dir, '../../bower_components');
                    if (dir === '/bower_components') {
                        break;
                    }
                }
            }

            this.npmDir = conf.npmDir || sjConf.npmDir || null;
            if (this.npmDir && this.npmDir.charAt(0) !== '/') {
                this.npmDir = path.join(this.workingDir, this.npmDir);
            }
            else {
                let dir = path.join(this.workingDir, 'node_modules');
                while (true) {
                    if (fl.exists(dir)) {
                        this.npmDir = dir;
                        break;
                    }

                    dir = path.join(dir, '../../node_modules');
                    if (dir === '/node_modules') {
                        break;
                    }
                }
            }


            log.debug('Working dir:', this.workingDir);
            log.debug('Root dir:', this.root);
            log.debug('Is UMD:', this.umd);
            log.debug('Skip submodules:', this.skipSubmodules);
            log.debug('Conf files:', this.confFiles);
            log.debug('Use libDir:', this.libDir);
            log.debug('Use bwrDir:', this.bwrDir);
            log.debug('Use npmDir:', this.npmDir);

            resolve();
        }.bind(this));
        
        return promise;
    }

    collectTask(conf) {
        var promise = new Promise(function(resolve, reject) {

            if (this.root.charAt(0) !== '/') {
                //Root is relative
                this.root = path.join(this.workingDir, this.root);
            }

            log.debug('Root path:', this.root);

            //addModule expects a parent path
            var rootFile = path.join(this.root, 'index.js');

            log.debug('Collecting files:', this.files);
            var files = this.files || [];
            files.forEach(function(file) {
                this.addModule(rootFile, file);
            }, this);

            if (this.main) {
                let main = this.resolve(rootFile, this.main);
                this.addModule(rootFile, main.name);
            }

            resolve();
        }.bind(this));

        return promise;
    }

    buildTask(args) {
        var promise = new Promise(function(resolve, reject) {
            var bundle = '';

            if (this.banner) {
                bundle += this.banner.trim() + '\n\n';
            }

            if (this.umd) {
                let deps = this.getUmdDependencies();
                log.debug('Create UMD module with name:', this.umd);
                this.umdSourceFile = this.loadFile(path.join(__dirname, '../public/umd.js'));
                this.umdSourceFile = this.umdSourceFile.replace(/\/\*\*SUPREJOIN_MODULE_NAME\*\*\//g, this.umd === true ? this.name : this.umd);
                this.umdSourceFile = this.umdSourceFile.replace(/\/\*\*SUPREJOIN_AMD_DEPS\*\*\//g, deps.amd);
                this.umdSourceFile = this.umdSourceFile.replace(/\/\*\*SUPREJOIN_CJS_DEPS\*\*\//g, deps.cjs);
                this.umdSourceFile = this.umdSourceFile.replace(/\/\*\*SUPREJOIN_WIN_DEPS\*\*\//g, deps.win);
                this.umdSourceFile = this.umdSourceFile.replace(/\/\*\*SUPERJOIN_DEPENDENCIES\*\*\//g, deps.deps);
                this.umdSourceFile = this.umdSourceFile.replace(/\/\*\*SUPERJOIN_MAIN_PATH\*\*\//g, this.main);
                this.umdSourceFile = this.umdSourceFile.split('/**SUPERJOIN-UMD-MODULES**/');
                
                bundle += this.umdSourceFile[0];
            }
            else if (!this.noRequire) {
                bundle += fl.read(path.join(__dirname, '../public/require.js'));
            }

            for (let script of this.scripts) {
                bundle += script.source;
            }

            if (this.dev) {
                bundle += '//Enable autoloading\nwindow.require.autoload = true;\n\n';
            }

            if (this.rcalls.length) {
                bundle += this.rcalls.join('\n');
            }

            if (this.main) {
                if (this.umd) {
                    bundle += 'return require(\'' + this.main + '\');';
                    bundle += this.umdSourceFile[1];
                }
                else {
                    bundle += 'require(\'' + this.main + '\');\n';
                }
            }

            this.bundle = bundle;

            resolve();
        }.bind(this));

        return promise;
    }

    /**
     * Write task
     *
     * @method writeTask
     * @private
     * 
     * @return {object} Returns a promise
     */
    writeTask() {
        var promise = new Promise(function(resolve, reject) {
            if (this.outfile) {
                log.debug('Write bundle file:', this.outfile);
                fl.write(this.outfile, this.bundle);
            }

            resolve();
        }.bind(this));

        return promise;
    }

    /**
     * Adds a file to superjoin
     * @param {String|Object} file Filename or a FileObject
     */
    add(file) {
        this.files.push(file);
    }

    /**
     * Add a module
     * 
     * @param {string} parent Path of parent file
     * @param {string} file   Filename or resolve object of loading module
     */
    addModule(parent, file) {
        log.debug('Add script module', parent, file);
        var resolved;
        if (typeof file === 'object') {
            resolved = {
                name: file.name,
                path: file.path
            };
        }
        else {
            resolved = this.resolve(parent, file);
        }

        log.debug(' ... resolved', resolved);

        var module = '';

        var name = resolved.name;
        if (resolved.alias) {
            module += 'require.alias[\'' + resolved.name + '\'] = \'' + resolved.alias + '\';\n';
            name = resolved.alias;
        }

        if (this.modules.indexOf(resolved.path) !== -1) {
            if (this.verbose) {
                log.debug('Module already added!', resolved.name);
            }            
  
            return '';
        }

        module += 'require.register(\'' + name + '\', function(module, exports, require) {\n';
        // if (this.verbose) {
        //     grunt.log.ok(' ... add module', resolved);
        // }

        var source = this.loadFile(resolved.path);

        module += (/\.json$/.test(resolved.path) ? 'module.exports = ' : '');
        module += source;
        module += '\n});\n';

        // if (this.sourceMaps) {
        //     var chunks = source.split('\n');
        //     chunks.forEach(function(line, index) {
        //         line += '\n';
        //         this.sourceNode.add(new SourceNode(index + 1, 0, path.basename(resolved.path), line));
        //     }, this);

        //     this.sourceNode.setSourceContent(path.basename(resolved.path), source || '//no content added yet!');
        // }

        // var out = [{
        //     path: name,
        //     src: module
        // }];

        this.modules.push(resolved.path);

        if (!this.skipSubmodules) {
            this.grepSubmodules(resolved);
        }

        this.scripts.push({
            path: name,
            source: module,
            src: resolved.path
        });
    }

    resolve(from, to) {
        log.debug('Resolve: "%s" "%s"', from, to);

        var fromDir = path.dirname(from);
        var resolved;

        var getPathProperties = function(path) {
            var resolved;

            if (this.libDir && path.indexOf(this.libDir) === 0) {
                resolved = {
                    path: path,
                    name: path.replace(this.libDir.replace(/\/$/, '') + '/', ''),
                    dir: this.libDir,
                    isModule: true
                };
            }

            if (!resolved && this.bwrDir && path.indexOf(this.bwrDir) === 0) {
                resolved = {
                    path: path,
                    name: path.replace(this.bwrDir.replace(/\/$/, '') + '/', ''),
                    dir: this.bwrDir,
                    isModule: true
                };
            }
            
            if (!resolved && this.npmDir && path.indexOf(this.npmDir) === 0) {
                resolved = {
                    path: path,
                    name: path.replace(this.npmDir.replace(/\/$/, '') + '/', ''),
                    dir: this.npmDir,
                    isModule: true
                };
            }

            if (!resolved) {
                resolved = {
                    path: path,
                    name: path.replace(this.root.replace(/\/$/, ''), '.'),
                    dir: this.root,
                    isModule: false
                };
            }

            return resolved;
        }.bind(this);

        var resolveModule = function(file) {
            var resolved;

            if (this.libDir) {
                resolved = this.loadModule('lib', file);
            }

            if (!resolved && this.bwrDir) {
                resolved = this.loadModule('bower', file);
            }
            
            if (!resolved && this.npmDir) {
                resolved = this.loadModule('npm', file);
            }

            if (!resolved) {
                log.debug('Resolve as local module:', file, resolved);
                //Try to resolve as local module
                resolved = this.resolve(from, './' + file);
                if (resolved) {
                    log.warn('Module ' + file + ' not found as module, but could resolve it as local module. It\'s better to require this module as a local module!');
                }
            }

            return resolved;
        }.bind(this);

        // var resolved;

        if (/^\$(npm|bower|lib)\/(.+)$/.test(to)) { //Its a module
            var type = RegExp.$1;
            resolved = this.loadModule(type, RegExp.$2);
        }
        else if (/\//.test(to)) { //Contains a slash
            if (/^\.\.?\//.test(to)) {
                resolved = path.resolve(fromDir, to);
                if (!/\.[a-z]{2,4}$/.test(resolved)) {
                    resolved += '.js';
                }

                resolved = getPathProperties(resolved);
            }
            else {
                //Handle module path
                resolved = to;
                if (!/\.[a-z]{2,4}$/.test(resolved)) {
                    resolved += '.js';
                }

                var modPath = to.split('/');
                var mod = resolveModule(modPath[0]);

                if (!mod) {
                    throw new Error('Module ' + modPath[0] + ' could not be found!');
                }

                resolved = {
                    name: to,
                    dir: mod.dir,
                    isModule: mod.isModule,
                    path: path.join(mod.dir, to)
                };
                
            }
        }
        else if (/\./.test(to)) { //Contains a dot, but no slash
            resolved = path.resolve(fromDir, to);
            if (fl.exists(resolved)) {
                resolved = getPathProperties(resolved);
            }
            else {
                resolved = resolveModule(to);
            }
        }
        else {
            resolved = resolveModule(to);
        }

        //Do we need an alias?
        if (path.join(resolved.dir, resolved.name) !== resolved.path) {
            resolved.alias = path.relative(resolved.dir, resolved.path);
        }

        return {
            path: resolved.path,
            name: resolved.name,
            dir: resolved.dir,
            isModule: resolved.isModule,
            alias: resolved.alias
        };
    }

    loadModule(moduleType, file) {
        var moduleDir,
            modulePrefix;

        switch (moduleType) {
            case 'lib':
                moduleDir = this.libDir;
                modulePrefix = '$lib';
                break;
            case 'bower':
                moduleDir = this.bwrDir;
                modulePrefix = '$bower';
                break;
            case 'npm':
                moduleDir = this.npmDir;
                modulePrefix = '$npm';
                break;
            default:
                throw new Error('Unknowd module type ' + moduleType + '!');
        }

        var nodeModule = path.join(moduleDir, file),
            name = file,
            filepath,
            filename;

        var dir = nodeModule;
        
        if (name.indexOf('/') !== -1) {
            filepath = nodeModule;
            if (!/\.js(on)?$/.test(name)) {
                name += '.js';
                filepath += '.js';
            }
        }
        else if (fl.exists(nodeModule)) {
            var bwr = fl.exists(path.join(nodeModule, '/bower.json')) ?
                require(path.join(nodeModule, '/bower.json')) : null;
            var pkg = fl.exists(path.join(nodeModule, '/package.json')) ?
                require(path.join(nodeModule, '/package.json')) : null;
            
            if (bwr) {
                filename = bwr.main;
                if (Array.isArray(bwr.main)) {
                    for (var i = 0, len = bwr.main.length; i < len; i++) {
                        if (/\.js$/.test(bwr.main[i])) {
                            filename = bwr.main[i];
                            break;
                        }
                    }
                }

                filepath = path.join(nodeModule, filename);
                filename = name + filepath.replace(dir, '');
            }
            else if (pkg && pkg.browser && typeof pkg.browser === 'string') {
                filename = pkg.browser;
                filepath = path.join(nodeModule, filename);
                filename = name + filepath.replace(dir, '');
            }
            else if (pkg && pkg.main) {
                filename = pkg.main;
                filepath = path.join(nodeModule, filename);
                filename = name + filepath.replace(dir, '');
            }
            else if (pkg) {
                filename = 'index.js';
                filepath = path.join(nodeModule, filename);
                filename = name + filepath.replace(dir, '');
            }
            else {
                throw new Error('No bower.json or package.json found in module ' + name + '!');
            }
        } else {
            return null;
        }

        return {
            name: name,
            dir: moduleDir,
            path: filepath,
            isModule: true,
            isNodeModule: true,
            prefix: modulePrefix
        };
    }

    /**
     * Load a file content, read from cache if it is cached, otherwise reads file from disk and add file to file cache
     * @param  {String} filename File path
     * @return {String}          Returns file content
     */
    loadFile(filename) {
        if (!this.fileCache[filename]) {
            log.debug('Load file into cache:', filename);
            this.fileCache[filename] = fl.read(filename);
        }

        return this.fileCache[filename];
    }

    addRequireCall(name) {
        return this.rcalls.push('require(\'' + name + '\');\n');
    }

    readConfFile(confFiles) {
        var conf;
        for (let file of confFiles) {
            if (fl.exists(file)) {
                if (/\/package.json$/.test(file)) {
                    var pkg = fl.readJSON(file);
                    if (pkg && pkg.superjoin) {
                        conf = pkg.superjoin;
                    }
                }
                else {
                    conf = fl.readJSON(file);
                    if (conf) {
                        if (conf.main && !/^\.{0,2}\//.test(conf.main)) {
                            conf.main = './' + conf.main;
                        }
                    }
                }

                if (conf) {
                    if (conf.main && !/^\.{0,2}\//.test(conf.main)) {
                        conf.main = './' + conf.main;
                    }
                    
                    break;
                }

            }
        }

        return conf || {};
    }

    grepSubmodules(module) {
        log.debug('Grep submodules from:', module);
        var pattern = /require\((.+?)\)/g;

        var source = this.loadFile(module.path);

        while(true) {
            var match = pattern.exec(source);
            if (!match) {
                break;
            }

            var subModule = match[1].trim();
            if (subModule.charAt(0) !== '"' && subModule.charAt(0) !== '\'') {
                log.warn('Could\'t resolve module name!', match[0]);
                continue;
            }

            subModule = subModule.slice(1, -1);

            if (this.umd && this.umdDependencies && Object.keys(this.umdDependencies).indexOf(subModule) !== -1) {
                log.debug('Module is an UMD dependency!', subModule);
                continue;
            }

            this.addModule(module.path, subModule);
        }
    }

    getUmdDependencies() {
        var deps = {
            amd: [],
            cjs: [],
            win: [],
            deps: []
        };

        if (this.umdDependencies) {
            for (var key in this.umdDependencies) {
                if (this.umdDependencies.hasOwnProperty(key)) {
                    let prop = this.umdDependencies[key];
                    deps.amd.push('\'' + prop[0] + '\'');
                    deps.cjs.push('require(\'' + prop[1] + '\')');
                    deps.win.push('window.' + prop[2]);
                    deps.deps.push('\'' + key + '\'');
                }
            }
        }

        deps.amd = deps.amd.join(', ');
        deps.cjs = deps.cjs.join(', ');
        deps.win = deps.win.join(', ');
        deps.deps = deps.deps.join(', ');

        return deps;
    }

    /**
     * Starts the bundler
     * 
     * @method build
     * 
     * @returns {Object} Returns a promise
     */
    build() {
        return this.run();
    }

    /**
     * Clears the file cache
     *
     * @method clearCache
     */
    clearCache() {
        this.fileCache = {};
    }

    //--
}

module.exports = Superjoin;
