const assert = require('assert');
const { ColorGameEngine } = require('../lib/color-engine');

for (let iteration = 0; iteration < 300; iteration++) {
  const game = new ColorGameEngine();
  const match = game.startMatch(iteration % 3 === 0 ? 'easy' : iteration % 3 === 1 ? 'medium' : 'hard');
  assert([5, 6].includes(match.target.length));
  assert([15000, 20000].includes(match.answerMs), 'Unexpected color-match answer time');
  assert.strictEqual(new Set(match.target.map(x => x.position)).size, match.target.length);
  const counts = {};
  match.target.forEach(x => counts[x.color] = (counts[x.color] || 0) + 1);
  assert(Math.max(...Object.values(counts)) <= 2, 'A color occurred more than twice');
  match.target.forEach(item => {
    const order = ['off', 'red', 'blue', 'green', 'yellow', 'purple'];
    while (game.entries[0][item.position - 1] !== item.color) game.cycle(0, item.position);
  });
  const result = game.evaluateMatch();
  assert.deepStrictEqual(result.correct, [true, false]);

  const sequence = game.startSequence('veryHard', iteration);
  assert.strictEqual(sequence.sequence.length, 8);
  assert(sequence.delayMs >= 300 && sequence.delayMs <= 1000);
  sequence.sequence.forEach((item, index) => {
    const press = game.pressSequence(1, item.position);
    assert.strictEqual(press.complete, index === sequence.sequence.length - 1);
    assert.strictEqual(press.correct, index === sequence.sequence.length - 1 ? true : null);
  });
  assert.strictEqual(game.sequenceProgress[1], 0);

  const wrong = game.startSequence('easy');
  for (let index = 0; index < wrong.sequence.length; index++) {
    const position = index === 0
      ? (wrong.sequence[0].position % 15) + 1
      : wrong.sequence[index].position;
    const press = game.pressSequence(0, position);
    if (index < wrong.sequence.length - 1) {
      assert.strictEqual(press.complete, false);
      assert.strictEqual(press.correct, null, 'Wrong input was disclosed before sequence completion');
    } else {
      assert.strictEqual(press.complete, true);
      assert.strictEqual(press.correct, false);
    }
  }
}
console.log('Color modes passed 300 consistency iterations.');

{
  let value=0;
  const game=new ColorGameEngine(()=>((value=(value+.173)%1)));
  const blue=game.startMatch('medium',0),orange=game.startMatch('medium',1);
  assert(!blue.target.some(x=>x.position===8),'button 8 must be reserved for confirmation');
  assert(!orange.target.some(x=>x.position===8),'button 8 must be reserved for confirmation');
  assert.notDeepStrictEqual(blue.target,orange.target,'players must receive independent patterns');
  for(const item of blue.target){const order=['off','red','blue','green','yellow','purple'];while(game.entries[0][item.position-1]!==item.color)game.cycle(0,item.position)}
  const result=game.evaluateMatch(0);
  assert(result.correct===true&&result.scores[0]===1&&result.scores[1]===0,'only the confirmed player should be scored');
}

console.log('Independent Color Code confirmation passed.');

{
  const game=new ColorGameEngine(()=>.42);
  for(const difficulty of ['easy','medium','hard','veryHard']){
    const round=game.startSequence(difficulty);
    assert(!round.sequence.some(item=>item.position===8),'button 8 must never be required in Light Melody');
  }
}

console.log('Light Melody works without button 8.');
