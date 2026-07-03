// Version: 1.0001
global.localStorage = (() => { let s={}; return {getItem:k=>k in s?s[k]:null,setItem:(k,v)=>{s[k]=String(v)},removeItem:k=>{delete s[k]}}; })();
global.window = {};
const ll = await import('./src/core/learning-loop.js');
const subj = await import('./src/core/subjects.js');
const know = await import('./src/core/knowledge.js');
function count(){ return subj.listSubjects().reduce((a,s)=>a+s.notes.length,0); }
console.log('default role        =', ll.getLearnRole(), '(expect learner)');
console.log('learningEnabled()   =', ll.learningEnabled(), '(expect true)');
ll.setLearnRole('reader');
console.log('after reader role   =', ll.getLearnRole(), 'enabled=', ll.learningEnabled(), '(expect reader / false)');
ll.setLearningEnabled(true);
console.log('reader + enable(true) -> enabled=', ll.learningEnabled(), '(expect false)');
const before = count();
const r = await ll.tick();
const after = count();
console.log('reader tick() result=', r, '| notes', before, '->', after, '(expect null, no change)');
ll.setLearnRole('learner');
console.log('back to learner     =', ll.getLearnRole(), 'enabled=', ll.learningEnabled(), '(expect learner / true)');
let loc = know.storageLocationLabel();
console.log('storage (no server):', JSON.stringify(loc.text));
know.saveSourcesSettings({ serverEndpoint: 'https://my-server/knowledge' });
loc = know.storageLocationLabel();
console.log('storage (server set):', JSON.stringify(loc.text), '| serverConfigured=', loc.serverConfigured);
