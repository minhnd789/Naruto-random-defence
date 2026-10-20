import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Rng } from '../../game/src/engine/rng';
import { BANNERS, roll } from './gacha';

const rngFn = (seed: number) => {
  const r = new Rng(seed);
  return () => r.next();
};

test('bảo hiểm: lượt thứ 120 không có 5★ chắc chắn ra tướng tăng tỉ lệ', () => {
  const never5 = () => 0.99; // không bao giờ trúng 5★ tự nhiên
  const { results, pity } = roll(BANNERS.premium, 120, 0, never5);
  assert.equal(results.filter((r) => r.rarity === 5).length, 1);
  const last = results[119];
  assert.equal(last.rarity, 5);
  assert.equal(last.pityHit, true);
  assert.equal(last.heroId, 'madara');
  assert.equal(pity, 0);
});

test('bảo hiểm cộng dồn qua nhiều lần quay', () => {
  const never5 = () => 0.99;
  let p = 0;
  for (let i = 0; i < 11; i++) p = roll(BANNERS.premium, 10, p, never5).pity;
  assert.equal(p, 110);
  const r = roll(BANNERS.premium, 10, p, never5);
  assert.equal(r.results[9].rarity, 5);
  assert.equal(r.pity, 0);
});

test('ra 5★ tự nhiên thì reset bảo hiểm', () => {
  let calls = 0;
  const rnd = () => (calls++ === 0 ? 0.001 : 0.99);
  const r = roll(BANNERS.premium, 1, 57, rnd);
  assert.equal(r.results[0].rarity, 5);
  assert.equal(r.pity, 0);
});

test('x10 luôn có ít nhất một 4★', () => {
  for (let s = 1; s < 300; s++) {
    const r = roll(BANNERS.normal, 10, 0, rngFn(s));
    assert.ok(r.results.some((x) => x.rarity >= 4), 'seed ' + s);
  }
});

test('tỉ lệ thực tế gần tỉ lệ công bố (200k lượt)', () => {
  const r = roll(BANNERS.normal, 200_000, 0, rngFn(99));
  const c5 = r.results.filter((x) => x.rarity === 5).length / 200_000;
  const c4 = r.results.filter((x) => x.rarity === 4).length / 200_000;
  assert.ok(Math.abs(c5 - 0.01) < 0.002, 'tỉ lệ 5★ ' + c5);
  assert.ok(Math.abs(c4 - 0.14) < 0.005, 'tỉ lệ 4★ ' + c4);
});

test('banner thường không có bảo hiểm', () => {
  const r = roll(BANNERS.normal, 500, 0, () => 0.99);
  assert.equal(r.results.filter((x) => x.rarity === 5).length, 0);
});
