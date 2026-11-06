import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { GAMES } from '../lib/games.ts';

const body = ({ emoji, name, description, status }) => `
  <span class="emoji" aria-hidden="true">${emoji}</span>
  <span><span class="name">${name}</span>${status === 'live' ? '' : ' (준비 중)'}<br><span class="desc">${description}</span></span>`;

const items = GAMES.map((game) =>
  game.status === 'live'
    ? `<li><a class="card" href="/games/${game.slug}/">${body(game)}</a></li>`
    : `<li><div class="card" aria-disabled="true">${body(game)}</div></li>`,
).join('\n');

const template = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
const dist = new URL('../dist/', import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await writeFile(new URL('index.html', dist), template.replace('<ul><!--GAMES--></ul>', `<ul>${items}</ul>`));
