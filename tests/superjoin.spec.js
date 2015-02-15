describe('Superjoin', function() {
    'use strict';

    var path = require('path'),
        fs = require('fs');

    var Superjoin = require('../superjoin');
    
    describe('resolve', function() {
        var superjoin;
        beforeEach(function() {
            superjoin = new Superjoin();
            superjoin.root = '/srv/supertest';
        });

        afterEach(function() {

        });

        it('Should resolve a relative filepath', function() {
            expect(superjoin.resolve('./test/module.js')).to.eql({
                name: './test/module.js',
                path: '/srv/supertest/test/module.js'
            });
        });

        it('Should resolve a relative filepath without a file ext', function() {
            expect(superjoin.resolve('./test/module')).to.eql({
                name: './test/module.js',
                path: '/srv/supertest/test/module.js'
            });
        });

        it('Should resolve a relative filepath of a json file', function() {
            expect(superjoin.resolve('./test/conf.json')).to.eql({
                name: './test/conf.json',
                path: '/srv/supertest/test/conf.json'
            });
        });

        it('Should resolve a relative filepath of a min file', function() {
            expect(superjoin.resolve('./test/conf.min')).to.eql({
                name: './test/conf.min.js',
                path: '/srv/supertest/test/conf.min.js'
            });
        });

        it('Should resolve an absolute filepath', function() {
            expect(superjoin.resolve('/srv/www/test/module.js')).to.eql({
                name: '/srv/www/test/module.js',
                path: '/srv/www/test/module.js'
            });
        });

        it('Should resolve an absolute filepath without ext', function() {
            expect(superjoin.resolve('/srv/www/test/module')).to.eql({
                name: '/srv/www/test/module.js',
                path: '/srv/www/test/module.js'
            });
        });

        it('Should resolve an absolute filepath of a json file', function() {
            expect(superjoin.resolve('/srv/www/test/conf.json')).to.eql({
                name: '/srv/www/test/conf.json',
                path: '/srv/www/test/conf.json'
            });
        });

        it('Should resolve a module using node_modules dir', function() {
            process.chdir(path.join(__dirname, './fixtures/'));
            superjoin.root = path.join(__dirname, 'fixtures');
            expect(superjoin.resolve('module1')).to.eql({
                name: 'module1',
                path: superjoin.root + '/node_modules/module1/main.js'
            });
        });

        it('Should resolve a module using node_modules dir, no main property is present', function() {
            process.chdir(path.join(__dirname, './fixtures/'));
            superjoin.root = path.join(__dirname, 'fixtures');
            expect(superjoin.resolve('module2')).to.eql({
                name: 'module2',
                path: superjoin.root + '/node_modules/module2/index.js'
            });
        });

        it('Should resolve a module using node_modules dir, use browser property as entry point', function() {
            superjoin.root = path.join(__dirname, 'fixtures');
            process.chdir(path.join(__dirname, './fixtures/'));
            expect(superjoin.resolve('module3')).to.eql({
                name: 'module3',
                path: superjoin.root + '/node_modules/module3/browser.js'
            });
        });
    });

    describe('getConf', function() {
        var superjoin;

        it('Should read superjoin conf file', function() {
            process.chdir(path.join(__dirname, './fixtures/'));
            superjoin = new Superjoin();
            superjoin.root = '/srv/supertest';

            expect(superjoin.getConf()).to.be.an('object');
            expect(superjoin.getConf()).to.eql({
                name: 'superjoin',
                root: 'public/',
                files: ['./modules/module1/index.js', 'module2', 'module3']
            });
        });

        it('Should read superjoin conf from package.json', function() {
            process.chdir(path.join(__dirname, './fixtures-pkg/'));
            superjoin = new Superjoin();
            superjoin.root = '/srv/supertest';

            expect(superjoin.getConf()).to.be.an('object');
            expect(superjoin.getConf()).to.eql({
                name: 'superjoin-pkg',
                root: './public/',
                files: ['a.js','b.js']
            });
        });

        it('Should try to read superjoin conf', function() {
            process.chdir(path.join(__dirname, '..'));
            superjoin = new Superjoin();
            superjoin.root = '/srv/supertest';

            expect(superjoin.getConf()).to.be.an('object');
            expect(superjoin.getConf()).to.eql({
               
            });
        });
    });

    describe('join', function() {
        var superjoin;

        beforeEach(function() {
            process.chdir(path.join(__dirname, './fixtures/'));
            superjoin = new Superjoin();
        });

        it('Should build a superjoin bundle', function() {
            var expected = fs.readFileSync('../fixtures-build/build.js', { encoding: 'utf8' });
            superjoin.root = 'public';
            expect(superjoin.join([
                "./modules/module1/index.js",
                "module2",
                "module3"
            ])).to.eql(expected);
        });
    });
});