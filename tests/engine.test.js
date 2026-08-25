const assert = require('assert');
const { GameEngine } = require('../lib/game-engine');
const config = { activeButtonsMin: 3, activeButtonsMax: 6, defaultGameMode: 'classic' };

function equalSets(a, b) {
  assert.deepStrictEqual([...a].sort((x,y)=>x-y), [...b].sort((x,y)=>x-y));
}

for (let iteration = 0; iteration < 200; iteration++) {
  let engine = new GameEngine(config);
  engine.start(0, 'classic');
  equalSets(engine.activeByPlayer[0], engine.activeByPlayer[1]);
  const classicPosition = [...engine.activeByPlayer[0]][0];
  assert(engine.press(0, classicPosition).accepted);
  assert(!engine.press(1, classicPosition).accepted, 'Classic position scored twice');
  equalSets(engine.activeByPlayer[0], engine.activeByPlayer[1]);

  engine = new GameEngine(config);
  engine.start(0, 'replacement');
  const replacementCount = engine.activeByPlayer[0].size;
  for (let hit = 0; hit < 30; hit++) {
    equalSets(engine.activeByPlayer[0], engine.activeByPlayer[1]);
    const position = [...engine.activeByPlayer[0]][0];
    assert(engine.press(hit % 2, position).accepted);
    assert.strictEqual(engine.activeByPlayer[0].size, replacementCount);
    assert.strictEqual(engine.activeByPlayer[1].size, replacementCount);
  }
  const boostedPosition = [...engine.activeByPlayer[0]][0];
  const beforeBoost = engine.scores[0];
  assert(engine.press(0, boostedPosition, Math.random, 2).accepted);
  assert.strictEqual(engine.scores[0], beforeBoost + 2, 'X2 did not add two score points');

  engine = new GameEngine(config);
  engine.start(0, 'independent');
  const orangeBefore = [...engine.activeByPlayer[1]];
  const independentCount = engine.activeByPlayer[0].size;
  const bluePosition = [...engine.activeByPlayer[0]][0];
  assert(engine.press(0, bluePosition).accepted);
  assert.strictEqual(engine.activeByPlayer[0].size, independentCount);
  assert.deepStrictEqual([...engine.activeByPlayer[1]], orangeBefore, 'Blue hit changed orange set');

  engine = new GameEngine(config);
  engine.start(0, 'duel');
  assert.strictEqual(engine.activeByPlayer[0].size, 1);
  equalSets(engine.activeByPlayer[0], engine.activeByPlayer[1]);
  const duelPosition = [...engine.activeByPlayer[0]][0];
  assert(engine.press(1, duelPosition).accepted);
  assert.strictEqual(engine.activeByPlayer[0].size, 1);
  equalSets(engine.activeByPlayer[0], engine.activeByPlayer[1]);
}

console.log('All four game modes passed 200 consistency iterations.');
