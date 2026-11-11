#!/usr/bin/env node
'use strict';
const { main, finish } = require('../lib/index.js');

main(process.argv.slice(2)).then(finish, (e) => {
  process.stderr.write(`openspec-ui: unexpected error: ${(e && e.stack) || e}\n`);
  process.exit(1);
});
