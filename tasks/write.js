'use strict';

let fl = require('node-fl');

module.exports = function(superjoin, log) {
  superjoin.registerTask('write', function *() {
    log.debug('Run write task');
    if (this.outfile) {
      log.debug('Write bundle file:', this.outfile);
      fl.write(this.outfile, this.bundle);
    }
  });
};
