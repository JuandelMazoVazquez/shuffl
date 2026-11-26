import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDeepLink, buildDeepLink, withoutDeepLink } from '../../js/links.js';

const KEY = 'AbCdEfGhIjKlMnOpQrSt_-';

test('parseDeepLink lee mezcla y origen, con o sin play y clave', () => {
  assert.deepEqual(parseDeepLink(`?mezcla=m_1&play=1&k=${KEY}`), { kind: 'mix', id: 'm_1', play: true, key: KEY });
  assert.deepEqual(parseDeepLink('?origen=37i9dQZF1DXcBWIGoYBM5M'), { kind: 'source', id: '37i9dQZF1DXcBWIGoYBM5M', play: false, key: null });
  assert.deepEqual(parseDeepLink('?origen=__liked__&play=1'), { kind: 'source', id: '__liked__', play: true, key: null });
  assert.deepEqual(parseDeepLink('?mezcla=a&play=true'), { kind: 'mix', id: 'a', play: false, key: null }, 'solo play=1 reproduce');
  assert.equal(parseDeepLink('?mezcla=a&k=corta').key, null, 'una clave con otro formato no cuenta');
});

test('parseDeepLink rechaza ids peligrosos, vacíos o ambiguos', () => {
  for (const s of ['', '?code=x&state=y', '?mezcla=', '?mezcla=../x', '?origen=a%2Fb', '?origen=a b', `?mezcla=${'x'.repeat(65)}`, '?mezcla=a&origen=b', '?origen=<script>']) {
    assert.equal(parseDeepLink(s), null, s);
  }
});

test('buildDeepLink y withoutDeepLink', () => {
  const base = 'https://juandelmazovazquez.github.io/new-spoti/';
  assert.equal(buildDeepLink(base, { mixId: 'm1', key: KEY }), `${base}?mezcla=m1&play=1&k=${KEY}`);
  assert.equal(buildDeepLink(`${base}?x=1#y`, { mixId: 'm2', play: false }), `${base}?mezcla=m2`);
  assert.deepEqual(parseDeepLink(new URL(buildDeepLink(base, { mixId: 'm-2', key: KEY })).search), { kind: 'mix', id: 'm-2', play: true, key: KEY });
  assert.equal(withoutDeepLink(`${base}?mezcla=m1&play=1&k=${KEY}`), base);
  assert.equal(withoutDeepLink(`${base}?origen=a&code=c`), `${base}?code=c`);
});
