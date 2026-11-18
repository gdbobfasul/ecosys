/* Единна входна точка: избира роля „мастер" или „клиент" според --role= или PL_ROLE. */
'use strict';
const arg = (process.argv.find(a => a.startsWith('--role=')) || '').split('=')[1];
const role = arg || process.env.PL_ROLE || 'master';
if (role === 'client') require('./client/main.cjs');
else require('./master/main.cjs');
