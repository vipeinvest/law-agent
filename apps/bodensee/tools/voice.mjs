#!/usr/bin/env node
/* Records the narration once ahead of time with OpenAI text-to-speech: <out>/<set>/<lang>/<key>.mp3 plus <out>/index.json.
 * The game plays these files from our own server; a text without a recording falls back to the device voice.
 *
 *   node tools/voice.mjs --texts dist/voice/texts.json --out dist/audio --key-file <file with OPENAI_API_KEY=...>
 *
 *   --set v1               recording set (folder name); a new voice gets a new set, so cached files never go stale
 *   --voice marin          --model gpt-4o-mini-tts       --lang de,en      --limit 20 (per language, for a trial run)
 *   --ffmpeg <exe>         re-encode to 48 kbit/s mono, about a third of the size
 *   --samples marin,coral  only a few trial recordings per voice into <out>/samples, to choose the voice by ear
 *
 * Existing files are kept, so an interrupted run simply continues. The key is never printed.
 * OpenAI's usage policies require telling listeners that the voice is AI-generated: the game shows
 * "Vorlesestimme: KI-generiert" as soon as recordings are in use.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const TEXTS = resolve(opt('--texts', 'dist/voice/texts.json'));
const OUT = resolve(opt('--out', 'dist/audio'));
const SET = opt('--set', 'v1').replace(/[^\w.-]/g, '');
const VOICE = opt('--voice', 'marin');
const MODEL = opt('--model', 'gpt-4o-mini-tts');
const FFMPEG = opt('--ffmpeg', null);
const LIMIT = Number(opt('--limit', Infinity));
const PARALLEL = 4;

// Same professor in every language: warm and lively, for children of about seven, never babyish.
const STYLE = 'You are Professor Ida Wellenstein, a warm and cheerful lake researcher. You talk over the radio to a child of about seven '
  + 'who steers a small yellow submarine through Lake Constance. Speak naturally and kindly, with gentle enthusiasm and clear '
  + 'pronunciation, at a calm pace with short natural pauses between sentences. Friendly and genuine, never babyish or exaggerated.';
const LANG = {
  de: 'Speak German as a native speaker, with natural standard German pronunciation.',
  en: 'Speak British English as a native speaker.',
  it: 'Speak Italian as a native speaker.',
  fr: 'Speak French as a native speaker.',
};

function readKey(file) {
  if (!file || !existsSync(file)) throw new Error('missing --key-file (a file with OPENAI_API_KEY=...)');
  const raw = readFileSync(file, 'utf8');
  const m = raw.match(/^\s*OPENAI_API_KEY\s*=\s*["']?([^"'\s]+)/m) || raw.trim().match(/^(sk-\S+)$/);
  if (!m) throw new Error(`no OPENAI_API_KEY in ${file}`);
  return m[1];
}
const KEY = readKey(opt('--key-file', ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hideKey = (s) => s.replace(/sk-[\w-]+/g, 'sk-…');

async function speech(input, lang, voice) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, voice, input, instructions: `${STYLE} ${LANG[lang]}`, response_format: 'mp3' }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const body = hideKey(await res.text());
    const retry = (res.status === 429 && !body.includes('insufficient_quota')) || res.status >= 500;
    if (retry && attempt < 6) {
      await sleep(1500 * attempt * attempt);
      continue;
    }
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
  }
}

function save(file, mp3) {
  mkdirSync(dirname(file), { recursive: true });
  if (!FFMPEG) {
    writeFileSync(file, mp3);
    return;
  }
  const raw = `${file}.raw.mp3`;
  writeFileSync(raw, mp3);
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', raw, '-ac', '1', '-b:a', '48k', `${file}.tmp.mp3`]);
  if (r.status !== 0) throw new Error(`ffmpeg: ${String(r.stderr).slice(0, 200)}`);
  renameSync(`${file}.tmp.mp3`, file);
  rmSync(raw);
}

async function pool(jobs, work) {
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      await work(job);
      done++;
      if (done % 25 === 0 || done === jobs.length) console.log(`  ${done}/${jobs.length}`);
    }
  }));
}

const texts = JSON.parse(readFileSync(TEXTS, 'utf8'));
const langs = (opt('--lang', Object.keys(texts.langs).join(','))).split(',').filter((l) => texts.langs[l] && LANG[l]);

if (args.includes('--samples')) {
  // The first radio messages: greeting and story start in German, the greeting in the other languages.
  const voices = opt('--samples', VOICE).split(',');
  const picks = langs.flatMap((l) => texts.langs[l].slice(0, l === 'de' ? 2 : 1).map((t, i) => ({ lang: l, i, t })));
  const jobs = voices.flatMap((voice) => picks.map((p) => ({ ...p, voice })));
  await pool(jobs, async ({ lang, i, t, voice }) => {
    const file = join(OUT, 'samples', `${voice}-${lang}-${i + 1}.mp3`);
    if (!existsSync(file)) save(file, await speech(t.spoken, lang, voice));
  });
  console.log(`samples in ${join(OUT, 'samples')}`);
  process.exit(0);
}

let chars = 0;
const jobs = [];
for (const lang of langs) {
  for (const t of texts.langs[lang].slice(0, LIMIT)) {
    const file = join(OUT, SET, lang, `${t.key}.mp3`);
    if (existsSync(file)) continue;
    jobs.push({ lang, t, file });
    chars += t.spoken.length;
  }
}
console.log(`${jobs.length} recordings to make, ${chars} characters, voice ${VOICE}, model ${MODEL}`);
await pool(jobs, async ({ lang, t, file }) => save(file, await speech(t.spoken, lang, VOICE)));

// Only texts of the current game version that have a file: a changed text falls back to the device voice until re-recorded.
const keys = {};
for (const [lang, list] of Object.entries(texts.langs)) {
  const have = list.filter((t) => existsSync(join(OUT, SET, lang, `${t.key}.mp3`))).map((t) => t.key);
  if (have.length) keys[lang] = have;
}
writeFileSync(join(OUT, 'index.json'), `${JSON.stringify({ set: SET, voice: VOICE, model: MODEL, game: texts.game, made: new Date().toISOString(), keys })}\n`);
console.log(`index: ${Object.entries(keys).map(([l, k]) => `${l} ${k.length}`).join(', ')}`);
