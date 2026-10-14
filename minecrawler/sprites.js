'use strict';
/* Pixel art for Minecrawler. Every sprite is a list of rows; one character = one pixel.
   Rows are padded to the widest row, and icons are centred in a 16x16 cell, so art can be
   slightly narrower than 16 without breaking anything. */
const PAL = {
  k: '#000000', w: '#ffffff', g: '#c0c0c0', d: '#808080', D: '#404040', s: '#e0e0e0',
  r: '#ff0000', R: '#800000', q: '#ff9aa8', y: '#ffff00', Y: '#c08000', o: '#ff8c00',
  b: '#2050ff', B: '#000080', c: '#00e0ff', C: '#008080', G: '#20c020', h: '#006000',
  n: '#b0682c', N: '#5a3010', p: '#f2e0a8', P: '#c8a060', m: '#c040c0', M: '#600060',
};

const ART = {
  mine: [
    '................',
    '........k.......',
    '........k.......',
    '....k.kkkkk.k...',
    '.....kkkkkkk....',
    '....kkwwkkkkk...',
    '....kkwwkkkkk...',
    '..kkkkkkkkkkkkk.',
    '....kkkkkkkkk...',
    '....kkkkkkkkk...',
    '.....kkkkkkk....',
    '....k.kkkkk.k...',
    '........k.......',
    '........k.......',
    '................',
    '................',
  ],
  flag: [
    '................',
    '................',
    '.......rr.......',
    '.....rrrr.......',
    '....rrrrr.......',
    '.....rrrr.......',
    '.......rr.......',
    '........k.......',
    '........k.......',
    '........k.......',
    '......kkkk......',
    '....kkkkkkkk....',
    '....kkkkkkkk....',
    '................',
    '................',
    '................',
  ],
  coin: [
    '................',
    '................',
    '.....kkkkkk.....',
    '....kyyyyyyk....',
    '...kyywyyyyYk...',
    '..kyywyyyyyyYk..',
    '..kywyyYYyyyYk..',
    '..kyyyyYyyyyYk..',
    '..kyyyyYyyyyYk..',
    '..kyyyyYyyyyYk..',
    '..kyyyYYYyyyYk..',
    '..kYyyyyyyyyYk..',
    '...kYYyyyyYYk...',
    '....kYYYYYYk....',
    '.....kkkkkk.....',
    '................',
  ],
  gem: [
    '................',
    '................',
    '....kkkkkkkk....',
    '...kcwwcccccbk..',
    '..kcwcccccccbbk.',
    '.kkkkkkkkkkkkkkk',
    '.kcwccccccccbbBk',
    '..kcwcccccccbBk.',
    '...kcccccccbBk..',
    '....kccccccBk...',
    '.....kcccbBk....',
    '......kccBk.....',
    '.......kBk......',
    '........k.......',
    '................',
    '................',
  ],
  heart: [
    '................',
    '................',
    '...kkk...kkk....',
    '..krrrk.krrrk...',
    '.krwwrrkrrrrrk..',
    '.krwrrrrrrrrrk..',
    '.krrrrrrrrrrrk..',
    '.krrrrrrrrrrRk..',
    '..krrrrrrrrRk...',
    '...krrrrrrRk....',
    '....krrrrRk.....',
    '.....krrRk......',
    '......kRk.......',
    '.......k........',
    '................',
    '................',
  ],
  potion: [
    '................',
    '......kkkk......',
    '......knnk......',
    '......kkkk......',
    '.......kk.......',
    '......kwwk......',
    '.....kwwwwk.....',
    '....kwrrrrrk....',
    '...kwrwwrrrrk...',
    '...krwrrrrrRk...',
    '...krrrrrrrRk...',
    '...krrrrrrRRk...',
    '....kRRRRRRk....',
    '.....kkkkkk.....',
    '................',
    '................',
  ],
  probe: [
    '................',
    '.............k..',
    '............ksk.',
    '...........ksdk.',
    '..........ksdk..',
    '.........ksdk...',
    '........ksdk....',
    '.......kkdk.....',
    '......kbbk......',
    '.....kbwbbk.....',
    '....kbwbbk......',
    '...kbwbbk.......',
    '..kbbbbk........',
    '..kbbbk.........',
    '...kkk..........',
    '................',
  ],
  sonar: [
    '................',
    '.....kkkkkk.....',
    '...kkGGGGGGkk...',
    '..kGGhhhhhhGGk..',
    '..kGhGGGGGGhGk..',
    '.kGhGGhhhhGGhGk.',
    '.kGhGhGGGGhGhGk.',
    '.kGhGhGwwGhGhGk.',
    '.kGhGhGwwGhGhGk.',
    '.kGhGhGGGGhGhGk.',
    '.kGhGGhhhhGGhGk.',
    '..kGhGGGGGGhGk..',
    '..kGGhhhhhhGGk..',
    '...kkGGGGGGkk...',
    '.....kkkkkk.....',
    '................',
  ],
  lantern: [
    '.......kk.......',
    '......k..k......',
    '......kkkk......',
    '.....kNNNNk.....',
    '....kkkkkkkk....',
    '....kywwyyyk....',
    '....kwyyyyok....',
    '....kyyyyyok....',
    '....kyyyyook....',
    '....kyyoooYk....',
    '....kkkkkkkk....',
    '.....kNNNNk.....',
    '......kkkk......',
    '................',
    '................',
    '................',
  ],
  shield: [
    '................',
    '...kkkkkkkkkk...',
    '...kbbbbsssskk..',
    '...kbbbbsssssk..',
    '...kbbbbsssssk..',
    '...kbbbbsssssk..',
    '...ksssssbbbbk..',
    '...ksssssbbbbk..',
    '....ksssssbbk...',
    '....ksssssbbk...',
    '.....kssssbk....',
    '......kssbk.....',
    '.......kkk......',
    '................',
    '................',
    '................',
  ],
  compass: [
    '................',
    '.....kkkkkk.....',
    '...kkYYYYYYkk...',
    '..kYYwwwwwwYYk..',
    '..kYwwwwrwwwYk..',
    '.kYwwwwwrwwwwYk.',
    '.kYwwwwrrrwwwYk.',
    '.kYwwwwrkrwwwYk.',
    '.kYwwwwdkdwwwYk.',
    '.kYwwwwdddwwwYk.',
    '.kYwwwwwdwwwwYk.',
    '..kYwwwwdwwwYk..',
    '..kYYwwwwwwYYk..',
    '...kkYYYYYYkk...',
    '.....kkkkkk.....',
    '................',
  ],
  stairs: [
    '................',
    '..kkkkkkkkkkkk..',
    '..kDDDDDDDDDDk..',
    '..kDnnnnnnnnDk..',
    '..kDNNNNNNNNDk..',
    '..kDkknnnnnnDk..',
    '..kDkkNNNNNNDk..',
    '..kDkkkknnnnDk..',
    '..kDkkkkNNNNDk..',
    '..kDkkkkkknnDk..',
    '..kDkkkkkkNNDk..',
    '..kDkkkkkkkkDk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
    '................',
  ],
  bag: [
    '................',
    '......kkkk......',
    '.......kk.......',
    '......kkkk......',
    '.....knnnnk.....',
    '....knnnnnnk....',
    '...knnnyynnnk...',
    '...knnyNNynnk...',
    '...knnnnyNnnk...',
    '...knnnyNnnnk...',
    '...knnnnnnnnk...',
    '...knnnyNnnnk...',
    '....kNNNNNNk....',
    '.....kkkkkk.....',
    '................',
    '................',
  ],
  chest: [
    '................',
    '................',
    '...kkkkkkkkkk...',
    '..knnnnnnnnnnk..',
    '.knNNNNNNNNNNnk.',
    '.knNNNNNNNNNNnk.',
    '.kkkkkkkyykkkkk.',
    '.kYYYYYkyykYYYk.',
    '.knnnnnkyyknnnk.',
    '.knnnnnnkknnnnk.',
    '.knNNNNNNNNNNnk.',
    '.knNNNNNNNNNNnk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
    '................',
  ],
  chestOpen: [
    '...kkkkkkkkkk...',
    '..knNNNNNNNNnk..',
    '..knNNNNNNNNnk..',
    '..kkkkkkkkkkkk..',
    '..kyywyyyyyyyk..',
    '.kkkkkkkkkkkkkk.',
    '.kyyywyyyyywyyk.',
    '.kkkkkkkyykkkkk.',
    '.kYYYYYkyykYYYk.',
    '.knnnnnkyyknnnk.',
    '.knnnnnnkknnnnk.',
    '.knNNNNNNNNNNnk.',
    '.knNNNNNNNNNNnk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ],
  dice: [
    '................',
    '..kkkkkkkkkkkk..',
    '..kwwwwwwwwwwdk.',
    '..kwkkwwwwkkwdk.',
    '..kwkkwwwwkkwdk.',
    '..kwwwwwwwwwwdk.',
    '..kwwwwkkwwwwdk.',
    '..kwwwwkkwwwwdk.',
    '..kwwwwwwwwwwdk.',
    '..kwkkwwwwkkwdk.',
    '..kwkkwwwwkkwdk.',
    '..kwwwwwwwwwwdk.',
    '..kddddddddddddk',
    '...kkkkkkkkkkkk.',
    '................',
    '................',
  ],
  door: [
    '....kkkkkkkk....',
    '...kNNNNNNNNk...',
    '..kNnnnnnnnnNk..',
    '..kNnNNnnNNnNk..',
    '..kNnNnnnnNnNk..',
    '..kNnNnnnnNnNk..',
    '..kNnNNnnNNnNk..',
    '..kNnnnnnnnnNk..',
    '..kNnnnnnnnyNk..',
    '..kNnNNnnNNyNk..',
    '..kNnNnnnnNnNk..',
    '..kNnNnnnnNnNk..',
    '..kNnNNnnNNnNk..',
    '..kNnnnnnnnnNk..',
    '.kkkkkkkkkkkkkk.',
    '.kddddddddddddk.',
  ],
  skull: [
    '................',
    '....kkkkkkkk....',
    '...kwwwwwwwwk...',
    '..kwwwwwwwwwsk..',
    '..kwkkkwwkkksk..',
    '..kwkkkwwkkksk..',
    '..kwwwwkkwwwsk..',
    '...kwwwwwwwsk...',
    '....kwkwkwsk....',
    '....kkkkkkkk....',
    '................',
    '................',
  ],
  crown: [
    '................',
    '................',
    '..k....k....k...',
    '.kyk..kyk..kyk..',
    '.kyyk.kyk.kyyk..',
    '.kyyykyyykyyyk..',
    '.kyyyyyryyyyyk..',
    '.kyyyyrrryyyyk..',
    '.kyyyyyryyyyyk..',
    '.kYYYYYYYYYYYk..',
    '.kkkkkkkkkkkkk..',
    '................',
  ],
  // ---- relics ----
  hardhat: [
    '................',
    '................',
    '................',
    '......kkkk......',
    '....kkyyyykk....',
    '...kyywwyyyYk...',
    '..kyywwwwyyyYk..',
    '..kyyywwyyyyYk..',
    '..kyyyyyyyyyYk..',
    '..kyyyyyyyyyYk..',
    '.kkkkkkkkkkkkkk.',
    '.kYYYYYYYYYYYYk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
    '................',
  ],
  clover: [
    '................',
    '....kkk..kkk....',
    '...kGGGkkGGGk...',
    '...kGwGGGGGhk...',
    '....kGGGGGhk....',
    '.kkk.kGGGhk.kkk.',
    'kGGGkkGGGGkkGGGk',
    'kGwGGGGGGGGGGGhk',
    'kGGGkkGGGGkkGGhk',
    '.kkk.kGGGhk.kkk.',
    '....kGGGGGhk....',
    '...kGGGkkGGhk...',
    '...kGhhkkhhhk...',
    '....kkk.kkkk....',
    '.......kk.......',
    '........kk......',
  ],
  goldpan: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '..kkkkkkkkkkk...',
    '.kdsssssssssdk..',
    '.kdsyyYsyYysdkkk',
    '..kdsYsssyssdknk',
    '...kdddddddddkk.',
    '....kkkkkkkkk...',
    '................',
    '................',
  ],
  magnet: [
    '................',
    '...kkkk..kkkk...',
    '...kssk..kssk...',
    '...kssk..kssk...',
    '...kkkk..kkkk...',
    '...krrk..krrk...',
    '...krrk..krrk...',
    '...krrk..krrk...',
    '...krrkkkkrrk...',
    '...krrrrrrrRk...',
    '....krrrrrRk....',
    '.....kkkkkk.....',
    '................',
  ],
  canary: [
    '................',
    '................',
    '.....kkkk.......',
    '....kyyyyk......',
    '...kyykyyyk.....',
    '..koyyyyyyk.....',
    '...kkyyyyyk.....',
    '....kyyyyyykk...',
    '...kyyyyYYYYyk..',
    '...kyyyyyYYYYk..',
    '....kyyyyyyyk...',
    '.....kkkkkkk....',
    '.......k..k.....',
    '......kk.kk.....',
    '................',
  ],
  medkit: [
    '................',
    '................',
    '......kkkk......',
    '.....k....k.....',
    '..kkkkkkkkkkkk..',
    '..kwwwwwwwwwwk..',
    '..kwwwwrrwwwwk..',
    '..kwwwwrrwwwwk..',
    '..kwwrrrrrrwwk..',
    '..kwwrrrrrrwwk..',
    '..kwwwwrrwwwwk..',
    '..kwwwwrrwwwwk..',
    '..kddddddddddk..',
    '..kkkkkkkkkkkk..',
    '................',
  ],
  map: [
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kpppppPpppppPk.',
    '.kpdpppPpppppPk.',
    '.kppdppPppprpPrk',
    '.kpppdpPpppprPpk',
    '.kppppdPppprprPk',
    '.kppppPdpppppPpk',
    '.kppppPpddppPPpk',
    '.kppppPpppdPpppk',
    '.kppppPppppPpppk',
    '.kkkkkkkkkkkkkkk',
    '................',
  ],
  specs: [
    '................',
    '................',
    '................',
    '................',
    'k..............k',
    'k..............k',
    '.kkkkkk..kkkkkk.',
    '.kcwcck..kcwcck.',
    '.kwccckkkkwccck.',
    '.kccccC..kccccCk',
    '.kkkkkk..kkkkkk.',
    '................',
    '................',
  ],
  stopwatch: [
    '......kkkk......',
    '.......kk.......',
    '.....kkkkkk.....',
    '...kkwwwwwwkk...',
    '..kwwwwkwwwwwk..',
    '..kwwwwkwwwwwk..',
    '.kwwwwwkwwwwwwk.',
    '.kwwwwwkwwwwwwk.',
    '.kwwwwwkkkkwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '..kwwwwwwwwwwk..',
    '..kdwwwwwwwwdk..',
    '...kkddddddkk...',
    '.....kkkkkk.....',
    '................',
  ],
  piggy: [
    '................',
    '................',
    '.......kkk......',
    '.....kkqqqkk....',
    '....kqqqkkqqk...',
    '...kqqqqqqqqqk..',
    '.kkqqkqqqqqqqqk.',
    'kqqqqqqqqqqqqqk.',
    'kqkqqqqqqqqqqqk.',
    'kqqqqqqqqqqqqk..',
    '.kkqqqqqqqqqqk..',
    '...kqqkkkkqqk...',
    '...kqk....kqk...',
    '...kkk....kkk...',
    '................',
  ],
  backpack: [
    '................',
    '.....kkkkkk.....',
    '....kn....nk....',
    '...kkkkkkkkkk...',
    '..knnnnnnnnnnk..',
    '..knNNNNNNNNnk..',
    '..knnnnnnnnnnk..',
    '..knnkkkkkknnk..',
    '..knnkyyyyknnk..',
    '..knnkkkkkknnk..',
    '..knnnnnnnnnnk..',
    '..knnnnnnnnnnk..',
    '..kNNNNNNNNNNk..',
    '...kkkkkkkkkk...',
    '................',
  ],
  boots: [
    '................',
    '................',
    '....kkkkkk......',
    '....knnnnk......',
    '....knNnnk......',
    '....knnnnk......',
    '....knnnnk......',
    '....knnnnk......',
    '....knnnnkkkk...',
    '...knnnnnnnnnk..',
    '...knnnnnnsssk..',
    '..knnnnnnsssssk.',
    '..kDDDDDDsssssk.',
    '..kkkkkkkkkkkkk.',
    '................',
  ],
  rod: [
    '................',
    '.kk..........kk.',
    '.knk........knk.',
    '..knk......knk..',
    '...knk....knk...',
    '....knk..knk....',
    '.....knkknk.....',
    '......knnk......',
    '.......knk......',
    '.......knk......',
    '.......knk......',
    '.......knk......',
    '.......knk......',
    '.......kkk......',
    '................',
  ],
  coupon: [
    '................',
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kyyyyyyyyyyyyk.',
    '.kykkyyyyyykyyk.',
    'kyykkyyyyykyyyyk',
    'kyyyyyyyykyyyyyk',
    'kyyyyyyykyyyyyyk',
    'kyyyyyykyyykkyyk',
    '.kyyyykyyyykkyk.',
    '.kyyyyyyyyyyyyk.',
    '.kkkkkkkkkkkkkk.',
    '................',
  ],
};

// 8x10 bold digits, drawn at (4,3) inside an open tile, like the original.
const GLYPHS = {
  1: ['...XX...', '..XXX...', '.XXXX...', '...XX...', '...XX...', '...XX...', '...XX...', '...XX...', '.XXXXXX.', '.XXXXXX.'],
  2: ['.XXXXXX.', 'XXXXXXXX', 'XX....XX', '.....XXX', '...XXXX.', '.XXXX...', 'XXX.....', 'XX......', 'XXXXXXXX', 'XXXXXXXX'],
  3: ['XXXXXXX.', 'XXXXXXXX', '......XX', '......XX', '..XXXXX.', '..XXXXX.', '......XX', '......XX', 'XXXXXXXX', 'XXXXXXX.'],
  4: ['...XXXX.', '..XXXXX.', '.XXX.XX.', 'XXX..XX.', 'XX...XX.', 'XXXXXXXX', 'XXXXXXXX', '.....XX.', '.....XX.', '.....XX.'],
  5: ['XXXXXXXX', 'XXXXXXXX', 'XX......', 'XX......', 'XXXXXXX.', 'XXXXXXXX', '......XX', '......XX', 'XXXXXXXX', 'XXXXXXX.'],
  6: ['.XXXXXX.', 'XXXXXXX.', 'XX......', 'XX......', 'XXXXXXX.', 'XXXXXXXX', 'XX....XX', 'XX....XX', 'XXXXXXXX', '.XXXXXX.'],
  7: ['XXXXXXXX', 'XXXXXXXX', '......XX', '.....XXX', '....XXX.', '...XXX..', '...XX...', '..XXX...', '..XX....', '..XX....'],
  8: ['.XXXXXX.', 'XXXXXXXX', 'XX....XX', 'XX....XX', '.XXXXXX.', 'XXXXXXXX', 'XX....XX', 'XX....XX', 'XXXXXXXX', '.XXXXXX.'],
  '?': ['.XXXXXX.', 'XXXXXXXX', 'XX....XX', '.....XXX', '...XXXX.', '...XX...', '...XX...', '........', '...XX...', '...XX...'],
};
// 3x5 digits for the little number in the corner of the stairs tile.
const TINY = {
  1: ['.X.', 'XX.', '.X.', '.X.', 'XXX'], 2: ['XX.', '..X', '.X.', 'X..', 'XXX'], 3: ['XX.', '..X', '.X.', '..X', 'XX.'],
  4: ['X.X', 'X.X', 'XXX', '..X', '..X'], 5: ['XXX', 'X..', 'XX.', '..X', 'XX.'], 6: ['.XX', 'X..', 'XXX', 'X.X', 'XXX'],
  7: ['XXX', '..X', '.X.', '.X.', '.X.'], 8: ['XXX', 'X.X', 'XXX', 'X.X', 'XXX'],
};
const NUM_COLORS = [null, '#0000ff', '#008000', '#ff0000', '#000080', '#800000', '#008080', '#000000', '#808080'];

const Sprites = (() => {
  const canvasCache = {}, urlCache = {};
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  function fromRows(rows, pal = PAL, size = 16) {
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    const S = Math.max(size, w, h);
    const c = mk(S, S), x = c.getContext('2d');
    const ox = Math.floor((S - w) / 2), oy = Math.floor((S - h) / 2);
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const col = pal[row[i]];
        if (col) { x.fillStyle = col; x.fillRect(ox + i, oy + j, 1, 1); }
      }
    });
    return c;
  }
  function glyph(rows, color, dx, dy, ctx) {
    ctx.fillStyle = color;
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === 'X') ctx.fillRect(dx + i, dy + j, 1, 1); });
  }

  function tileHidden() {
    const c = mk(16, 16), x = c.getContext('2d');
    x.fillStyle = PAL.g; x.fillRect(0, 0, 16, 16);
    x.fillStyle = PAL.w; x.fillRect(0, 0, 16, 2); x.fillRect(0, 0, 2, 16);
    x.fillStyle = PAL.d; x.fillRect(0, 14, 16, 2); x.fillRect(14, 0, 2, 16);
    // diagonal corners, like a real bevel
    x.fillStyle = PAL.w; x.fillRect(14, 0, 1, 1); x.fillRect(0, 14, 1, 1);
    x.fillStyle = PAL.g; x.fillRect(15, 0, 1, 1); x.fillRect(14, 1, 1, 1); x.fillRect(0, 15, 1, 1); x.fillRect(1, 14, 1, 1);
    return c;
  }
  function tileOpen(bg = PAL.g) {
    const c = mk(16, 16), x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, 16, 16);
    x.fillStyle = PAL.d; x.fillRect(0, 0, 16, 1); x.fillRect(0, 0, 1, 16);
    return c;
  }
  function number(n) {
    const c = mk(16, 16), x = c.getContext('2d');
    glyph(GLYPHS[n], n === '?' ? '#7a3fa0' : NUM_COLORS[n], 4, 3, x);
    return c;
  }
  function tiny(n, color) {
    const c = mk(4, 6), x = c.getContext('2d');
    x.fillStyle = 'rgba(192,192,192,.9)'; x.fillRect(0, 0, 4, 6);
    glyph(TINY[n], color, 0, 0, x);
    return c;
  }
  function crossedMine() {
    const c = fromRows(ART.mine), x = c.getContext('2d');
    x.fillStyle = PAL.r;
    for (let i = 0; i < 12; i++) { x.fillRect(2 + i, 2 + i, 1, 1); x.fillRect(3 + i, 2 + i, 1, 1); x.fillRect(13 - i, 2 + i, 1, 1); x.fillRect(14 - i, 2 + i, 1, 1); }
    return c;
  }

  // Smiley faces, 17x17, built from a base disc plus features.
  const FACE_BASE = [
    '......kkkkk......', '....kkyyyyykk....', '...kyyyyyyyyyk...', '..kyyyyyyyyyyyk..', '.kyyyyyyyyyyyyyk.',
    '.kyyyyyyyyyyyyyk.', 'kyyyyyyyyyyyyyyyk', 'kyyyyyyyyyyyyyyyk', 'kyyyyyyyyyyyyyyyk', 'kyyyyyyyyyyyyyyyk',
    'kyyyyyyyyyyyyyyyk', '.kyyyyyyyyyyyyyk.', '.kyyyyyyyyyyyyyk.', '..kyyyyyyyyyyyk..', '...kyyyyyyyyyk...',
    '....kkyyyyykk....', '......kkkkk......',
  ];
  function face(kind) {
    const c = mk(17, 17), x = c.getContext('2d');
    x.drawImage(fromRows(FACE_BASE, PAL, 17), 0, 0);
    const P = (col, pts) => { x.fillStyle = col; pts.forEach(([a, b]) => x.fillRect(a, b, 1, 1)); };
    const k = PAL.k;
    const eyes = () => P(k, [[5, 5], [6, 5], [5, 6], [6, 6], [10, 5], [11, 5], [10, 6], [11, 6]]);
    const smile = () => P(k, [[4, 10], [12, 10], [5, 11], [11, 11], [6, 12], [7, 12], [8, 12], [9, 12], [10, 12]]);
    if (kind === 'smile') { eyes(); smile(); }
    if (kind === 'oh') { eyes(); P(k, [[7, 10], [8, 10], [9, 10], [6, 11], [10, 11], [6, 12], [10, 12], [7, 13], [8, 13], [9, 13]]); }
    if (kind === 'dead') {
      P(k, [[4, 4], [6, 4], [5, 5], [4, 6], [6, 6], [10, 4], [12, 4], [11, 5], [10, 6], [12, 6]]);
      P(k, [[6, 11], [7, 11], [8, 11], [9, 11], [10, 11], [5, 12], [11, 12], [4, 13], [12, 13]]);
    }
    if (kind === 'cool') {
      P(k, [[3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [12, 5], [13, 5],
        [4, 6], [5, 6], [6, 6], [7, 6], [9, 6], [10, 6], [11, 6], [12, 6], [5, 7], [6, 7], [10, 7], [11, 7], [2, 4], [14, 4]]);
      P(PAL.w, [[5, 6], [10, 6]]);
      smile();
    }
    if (kind === 'hurt') {
      P(k, [[4, 4], [5, 5], [6, 6], [4, 6], [12, 4], [11, 5], [10, 6], [12, 6]]);
      P(k, [[5, 12], [6, 11], [7, 12], [8, 11], [9, 12], [10, 11], [11, 12]]);
      P('#6cf', [[4, 8], [4, 9]]);
    }
    if (kind === 'boss') {
      P(k, [[4, 3], [5, 4], [6, 5], [12, 3], [11, 4], [10, 5]]);
      P(PAL.r, [[5, 6], [6, 6], [10, 6], [11, 6]]); P(k, [[5, 7], [6, 7], [10, 7], [11, 7]]);
      P(k, [[5, 11], [6, 11], [7, 11], [8, 11], [9, 11], [10, 11], [11, 11], [5, 12], [11, 12], [5, 13], [6, 13], [7, 13], [8, 13], [9, 13], [10, 13], [11, 13]]);
      P(PAL.w, [[6, 12], [8, 12], [10, 12]]);
    }
    return c;
  }

  // Seven-segment LED digits, 13x23 each, with dim unlit segments.
  const SEG = {
    a: [[1, 2, 10], [2, 3, 9], [3, 4, 8]], g: [[10, 3, 9], [11, 2, 10], [12, 3, 9]], d: [[19, 4, 8], [20, 3, 9], [21, 2, 10]],
  };
  const VSEG = { f: [1, 2, 10, 1], e: [1, 12, 20, 1], b: [11, 2, 10, -1], c: [11, 12, 20, -1] };
  const DIGIT_SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
  function ledDigit(ch) {
    const c = mk(13, 23), x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 13, 23);
    const lit = DIGIT_SEGS[ch] ?? '';
    for (const s of 'abcdefg') {
      x.fillStyle = lit.includes(s) ? '#ff0000' : '#3a0000';
      if (SEG[s]) SEG[s].forEach(([y, x0, x1]) => x.fillRect(x0, y, x1 - x0 + 1, 1));
      else {
        const [x0, y0, y1, dir] = VSEG[s];
        for (let k = 0; k < 3; k++) x.fillRect(x0 + k * dir, y0 + k, 1, y1 - y0 + 1 - 2 * k);
      }
    }
    return c;
  }

  function get(name) {
    if (canvasCache[name]) return canvasCache[name];
    let c;
    if (name === 'tileHidden') c = tileHidden();
    else if (name === 'tileOpen') c = tileOpen();
    else if (name === 'tileRed') c = tileOpen(PAL.r);
    else if (name === 'mineX') c = crossedMine();
    else if (name === 'heartEmpty') c = fromRows(ART.heart, { ...PAL, r: '#8a8a8a', R: '#5a5a5a', w: '#b0b0b0' });
    else if (name === 'mineGhost') c = fromRows(ART.mine, { ...PAL, w: '#ffb0b0', k: '#a00000' });
    else if (name.startsWith('num')) c = number(name.slice(3));
    else if (name.startsWith('face_')) c = face(name.slice(5));
    else if (name.startsWith('led')) c = ledDigit(name.slice(3));
    else if (name.startsWith('tiny')) c = tiny(name.slice(4), NUM_COLORS[name.slice(4)]);
    else if (ART[name]) c = fromRows(ART[name]);
    else throw new Error('No sprite ' + name);
    return (canvasCache[name] = c);
  }
  function url(name) { return urlCache[name] || (urlCache[name] = get(name).toDataURL()); }
  function img(name, cls = '') { return `<img class="px ${cls}" src="${url(name)}" alt="">`; }
  return { get, url, img };
})();
