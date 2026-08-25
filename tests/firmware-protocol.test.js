const assert=require('assert');
const fs=require('fs');
const path=require('path');
const ino=fs.readFileSync(path.join(__dirname,'..','arduino','Lightning_LED_Controller_Nano','Lightning_LED_Controller_Nano.ino'),'utf8');

assert(ino.includes('startPositionFeedback(side == \'B\' ? 0 : 1'), 'FLASHPOS must start non-blocking per-player feedback');
assert(ino.includes('startPanelFeedback(0, command.endsWith("G"))'), 'blue panel feedback must be non-blocking');
assert(ino.includes('startPanelFeedback(1, command.endsWith("G"))'), 'orange panel feedback must be non-blocking');
assert(!/FLASHPOS[\s\S]{0,220}delay\(/.test(ino), 'FLASHPOS command path must not block the controller');
assert(ino.includes('applyPositionFeedback(player, strip, order)'), 'moving modes must preserve their animation under feedback');
assert(ino.includes('updatePanelFeedbacks();'), 'panel feedback must be updated from the main loop');
console.log('Arduino non-blocking feedback protocol passed.');
