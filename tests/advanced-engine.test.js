const assert = require('assert');
const { AdvancedGameEngine } = require('../lib/advanced-engine');

let seed = 123456;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);

{
  const game = new AdvancedGameEngine(random);
  game.startPaint();
  assert(game.paint(0, 1));
  assert(game.paintOwners[0] === 0);
  assert(game.paint(1, 1));
  assert(game.paintOwners[0] === 1, 'opponent must be able to repaint a position');
  for (let p = 2; p <= 15; p++) game.paint(0, p);
  const result = game.finishPaintRound();
  assert.deepStrictEqual(result.counts, [14, 1]);
  assert.deepStrictEqual(result.scores, [1, 0]);
}

{
  const game = new AdvancedGameEngine(() => 0);
  game.startCatch('score', 'easy', 0);
  const target = game.catchTargets[0];
  target.phase = 1; // blue
  target.startedAt = 0;
  const result = game.pressCatch(0, target.position, 0);
  assert(result.outcome === 'hit');
  assert(result.scores[0] === 1);
}

{
  const game = new AdvancedGameEngine(random);
  game.startIntersection('easy', 0);
  for (let i = 1; i <= 100; i++) {
    const dots = game.updateIntersection(i * 50);
    for (const pair of dots) for (const value of pair) assert(value >= 0 && value <= 14);
  }
  const pair=game.intersection[1].dots;pair[0].position=7;pair[1].position=8.2;pair[0].direction=pair[1].direction=1;pair[0].lastAt=pair[1].lastAt=5000;
  game.updateIntersection(5001);
  assert.notStrictEqual(pair[0].direction,pair[1].direction,'nearby dots must be separated instead of moving synchronously');
  pair[0].position=pair[1].position=6;pair[0].lastAt=pair[1].lastAt=6000;game.intersection[1].cooldownUntil=0;
  game.updateIntersection(6000);
  assert.strictEqual(game.intersection[1].holdUntil,6500,'intersection must remain visible for 500 ms');
  assert.strictEqual(game.pressIntersection(1,7,6100).hit,true,'only the exact shared button must score');
  assert.strictEqual(game.pressIntersection(1,6,6200).hit,false,'a neighbouring button must not score');
}

{
  const game = new AdvancedGameEngine(() => .4);
  const pong = game.startPong('easy', 0);
  const served = game.pressPong(pong.server, pong.paddle[pong.server], 0);
  assert(served.serve);
  const receiver=served.pong.receiver,entry=receiver===0?14:15;
  assert(Math.abs(game.globalPaddle(receiver,served.pong.paddle[receiver])-entry)>=5,'receiver paddle must stay five LEDs from the entry edge');
  for (let i = 1; i < 100 && game.scores[0] + game.scores[1] === 0; i++) game.updatePong(i * 100);
  assert(game.scores[0] + game.scores[1] === 1, 'a missed ball must award a point');
}

{
  const game = new AdvancedGameEngine(() => .9);
  const pong = game.startPong('veryHard', 0);
  const served = game.pressPong(pong.server, pong.paddle[pong.server], 0);
  const receiver = served.pong.receiver;
  const paddleBeforeEntry = served.pong.paddle[receiver];
  for (let now = 50; now <= 2000 && !game.pong.randomizedEntry; now += 50) game.updatePong(now);
  assert(game.pong.randomizedEntry, 'very hard ball must choose a random receiver-side entry');
  assert.equal(game.pong.paddle[receiver], paddleBeforeEntry, 'random ball entry must not mirror or move the receiver paddle');
  assert(Math.abs(game.globalPaddle(receiver, paddleBeforeEntry) - game.pong.ball) >= 5, 'fixed paddle must be at least five LEDs from either random entry edge');
}

{
  const game = new AdvancedGameEngine(() => .9);
  const pong = game.startPong('hard', 0), served = game.pressPong(pong.server, pong.paddle[pong.server], 0);
  const receiver = served.pong.receiver, paddle = game.globalPaddle(receiver, served.pong.paddle[receiver]);
  served.pong.ball = paddle - served.pong.direction * 3;
  const early = game.pressPong(receiver, served.pong.paddle[receiver], 100);
  assert(early.point, 'a press three LEDs before the paddle must be a miss');
}

{
  const game = new AdvancedGameEngine(() => .9);
  const pong = game.startPong('veryHard', 0), served = game.pressPong(pong.server, pong.paddle[pong.server], 0);
  const receiver = served.pong.receiver;
  for(let now=50;now<2500&&!game.pong.randomizedEntry;now+=50)game.updatePong(now);
  const paddleGlobal=game.globalPaddle(receiver,game.pong.paddle[receiver]);
  game.pong.ball=paddleGlobal;
  const hit=game.pressPong(receiver,game.pong.paddle[receiver],2600);
  assert(hit.hit,'receiver must hit while the ball is on the paddle');
  const hitter=receiver,scoreBefore=[...game.scores];
  for(let now=2650;now<5000&&!game.pong.randomizedEntry;now+=50)game.updatePong(now);
  assert(game.pong.randomizedEntry,'ball leaving either hitter edge must transfer to the new receiver field');
  assert.deepEqual(game.scores,scoreBefore,'successful hitter must not lose a point when the ball leaves the outer edge');
  assert.equal(game.pong.server,hitter);
}

console.log('Advanced modes passed consistency checks.');
