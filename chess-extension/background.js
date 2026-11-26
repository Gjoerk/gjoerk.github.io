/* Analyze on gabrielschwarz.com: click the toolbar icon on a chess.com game and it opens in the analyzer. */
importScripts('chess.js'); // chess.js 0.10.3 (BSD-2-Clause), bundled because extensions cannot load remote code

const ANALYZER = 'https://gabrielschwarz.com/chess/';

chrome.action.onClicked.addListener(async tab => {
  const tabId = tab.id;
  badge(tabId, '…', '#5b8def');
  try {
    if (!/^https:\/\/([a-z0-9-]+\.)?chess\.com\//i.test(tab.url || '')) throw new Error('Open a game on chess.com first, then click the icon.');
    const [{ result: page } = {}] = await chrome.scripting.executeScript({ target: { tabId }, func: readGame });
    if (!page || page.error) throw new Error((page && page.error) || 'Could not read this page.');
    const pgn = await buildPgn(page);
    let url = ANALYZER + '#pgn=' + encodeURIComponent(pgn);
    // tell the analyzer which side is yours, but only when the signed-in user played this game
    const me = await signedInUser(tabId), players = [...pgn.matchAll(/^\[(?:White|Black) "([^"]*)"\]/gm)].map(x => x[1].toLowerCase());
    if (me && players.includes(me.toLowerCase())) url += '&me=' + encodeURIComponent(me);
    await chrome.tabs.create({ url, index: tab.index + 1, openerTabId: tabId });
    badge(tabId, '');
  } catch (e) {
    badge(tabId, '!', '#d9534f');
    chrome.scripting.executeScript({ target: { tabId }, func: toast, args: [e.message || String(e)] }).catch(() => {});
    setTimeout(() => badge(tabId, ''), 4000);
  }
});

function badge(tabId, text, color) {
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  if (color) chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(() => {});
}

/**
 * Runs inside the chess.com tab. Finds the game id in the address (or the page's canonical link),
 * then asks chess.com's own game endpoint for it. Same-origin, so it works for your private games too.
 */
async function readGame() {
  const find = u => {
    if (!u) return null;
    let m = u.match(/\/game\/(live|daily)\/(\d+)/) || u.match(/\/(live|daily)\/game\/(\d+)/) || u.match(/[?&#](live|daily)?game[_-]?id=(\d+)/i);
    if (m) return { type: m[1] || null, id: m[2] };
    m = u.match(/\/game\/(\d+)/);
    return m ? { type: null, id: m[1] } : null;
  };
  const canon = document.querySelector('link[rel="canonical"]'), og = document.querySelector('meta[property="og:url"]');
  const g = find(location.href) || find(canon && canon.href) || find(og && og.content);
  if (!g) return { error: 'No game found on this page. Open a finished game (its address has /game/ in it) and click again.' };
  // player names shown next to the board, for the public-API fallback if the game endpoint fails
  const names = [...document.querySelectorAll('[data-test-element="user-tagline-username"], .user-username-component, .cc-user-username-component')]
    .map(e => e.textContent.trim()).filter(n => /^[\w-]{3,25}$/.test(n)).slice(0, 2);
  for (const type of g.type ? [g.type] : ['live', 'daily']) {
    try {
      const r = await fetch(`/callback/${type}/game/${g.id}`, { credentials: 'include', headers: { accept: 'application/json' } });
      if (r.ok) { const data = await r.json(); if (data && data.game) return { id: g.id, type, data, names }; }
    } catch (e) { /* try the next kind of game */ }
  }
  return { id: g.id, type: g.type || 'live', data: null, names };
}

/** The signed-in chess.com user, read from the page's own context object (empty if not signed in). */
async function signedInUser(tabId) {
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN',
      func: () => { try { const u = window.context && window.context.user; return (u && u.username) || ''; } catch (e) { return ''; } } });
    return typeof result === 'string' ? result : '';
  } catch (e) { return ''; }
}

/** Runs inside the chess.com tab to say what went wrong, since the icon has no popup. */
function toast(msg) {
  const old = document.getElementById('gs-analyze-toast'); if (old) old.remove();
  const d = document.createElement('div');
  d.id = 'gs-analyze-toast'; d.textContent = msg;
  d.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;max-width:340px;padding:12px 16px;border-radius:10px;background:#1f2430;color:#fff;font:14px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 5000);
}

/** The PGN for the game: rebuilt from chess.com's move list, or taken from the public API as a fallback. */
async function buildPgn({ id, type, data, names = [] }) {
  if (data) { try { return pgnFromCallback(id, type, data.game); } catch (e) { /* fall through to the API */ } }
  const h = (data && data.game && data.game.pgnHeaders) || {};
  const pgn = await pgnFromApi(id, h.White ? [h.White, h.Black].filter(Boolean) : names, h.Date);
  if (pgn) return pgn;
  throw new Error(data ? 'chess.com did not return this game yet. Try again in a minute.' : 'Could not load this game from chess.com. Is it finished?');
}

// chess.com's compact move encoding ("TCN"): two characters per move
const TCN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?{~}(^)[_]@#$,./&-*++=';
function decodeTcn(s) {
  const sq = i => 'abcdefgh'[i % 8] + (Math.floor(i / 8) + 1), out = [];
  for (let i = 0; i + 1 < s.length; i += 2) {
    const a = TCN.indexOf(s[i]); let b = TCN.indexOf(s[i + 1]); const mv = {};
    if (a < 0 || b < 0) throw new Error('bad move code');
    if (b > 63) { mv.promotion = 'qnrb'[Math.floor((b - 64) / 3)]; b = a + (a < 16 ? -8 : 8) + ((b - 1) % 3) - 1; }
    if (a > 63) throw new Error('drop moves are not chess');
    mv.from = sq(a); mv.to = sq(b); out.push(mv);
  }
  return out;
}

function pgnFromCallback(id, type, game) {
  if (!game || typeof game.moveList !== 'string') throw new Error('no move list');
  const h = game.pgnHeaders || {};
  const chess = h.FEN ? new Chess(h.FEN) : new Chess();
  const startFen = chess.fen();
  for (const mv of decodeTcn(game.moveList)) {
    // castling can be sent as king-takes-rook; map it to the king's real destination
    const castle = { e1h1: 'g1', e1a1: 'c1', e8h8: 'g8', e8a8: 'c8' }[mv.from + mv.to];
    const piece = chess.get(mv.from);
    if (!chess.move(mv) && !(castle && piece && piece.type === 'k' && chess.move({ from: mv.from, to: castle }))) throw new Error('illegal move ' + mv.from + mv.to);
  }
  const hist = chess.history();
  if (!hist.length) throw new Error('no moves');
  const result = /^(1-0|0-1|1\/2-1\/2)$/.test(h.Result) ? h.Result : '*';
  const tags = { Event: 'Live Chess', Site: 'Chess.com', Date: '????.??.??', Round: '-', White: '?', Black: '?', ...h, Result: result,
    Link: `https://www.chess.com/game/${type}/${id}` };
  if (startFen !== new Chess().fen()) { tags.SetUp = '1'; tags.FEN = startFen; }
  const head = Object.entries(tags).filter(([, v]) => v != null && v !== '').map(([k, v]) => `[${k} "${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`);
  // move numbers, starting from the position's own move number and side to move
  const f = startFen.split(' '); let n = +f[5] || 1, white = f[1] === 'w';
  const body = [];
  hist.forEach((san, i) => {
    if (white) body.push(n + '. ' + san); else body.push((i === 0 ? n + '... ' : '') + san);
    if (!white) n++; white = !white;
  });
  body.push(result);
  return head.join('\n') + '\n\n' + body.join(' ') + '\n';
}

/** Fallback: look the game up in a player's monthly archive on api.chess.com. */
async function pgnFromApi(id, players, date) {
  if (!players.length) return null;
  const d = (date || '').match(/^(\d{4})\.(\d{2})/), now = new Date();
  let y = d ? +d[1] : now.getUTCFullYear(), m = d ? +d[2] : now.getUTCMonth() + 1;
  const months = [];
  for (let k = 0; k < 2; k++) { // the archive is by end date, so a game can sit in the next (or, without a date, the previous) month
    months.push([y, m]);
    if (d) { m++; if (m > 12) { m = 1; y++; } } else { m--; if (m < 1) { m = 12; y--; } }
  }
  for (const p of players) for (const [yy, mm] of months) {
    try {
      const r = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(p.toLowerCase())}/games/${yy}/${String(mm).padStart(2, '0')}`);
      if (!r.ok) continue;
      const g = ((await r.json()).games || []).find(x => x.url && x.url.replace(/\/$/, '').endsWith('/' + id));
      if (g && g.pgn) return g.pgn;
    } catch (e) { /* try the next month or player */ }
  }
  return null;
}
