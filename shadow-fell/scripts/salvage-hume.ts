// Salvage every EVI chat from a Hume account before the API closes (access ends 13 November 2026,
// 12:01 a.m. EST, and account data is deleted after that): each chat's transcript, the prosody
// scores Hume attached to every user line, and, with --audio, the reconstructed recording.
// Usage: npx tsx scripts/salvage-hume.ts [--list] [--audio] [--force] [--only <chatId>] [--out <dir>]
//   --list   only print the chats and how many scored lines each holds; write nothing
//   --audio  ask Hume to reconstruct each chat's audio and download it when it is ready (run again later for the rest)
//   --force  fetch a chat again even when its file is already here
// Needs HUME_API_KEY in .env. Writes art/hume-salvage/<chatId>.json and an index.json; art/ is never committed.
// The scores are the material any replacement ear is fitted against, so keep this folder somewhere safe.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { HumeClient } from "hume";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

if (flag("--help") || flag("-h")) {
  console.log("Usage: npx tsx scripts/salvage-hume.ts [--list] [--audio] [--force] [--only <chatId>] [--out <dir>]");
  process.exit(0);
}
const key = process.env.HUME_API_KEY;
if (!key) { console.error("HUME_API_KEY is not set in .env; nothing can be fetched without it."); process.exit(1); }

const listOnly = flag("--list");
const wantAudio = flag("--audio");
const force = flag("--force");
const only = opt("--only");
const out = path.resolve(opt("--out") ?? "art/hume-salvage");
const client = new HumeClient({ apiKey: key });
const iso = (ms: number | undefined): string | null => (ms ? new Date(ms).toISOString() : null);

interface SavedEvent {
  id: string;
  at: string | null;
  role: string;
  type: string;
  text: string;
  /** Hume's prosody scores for a user line, as it sent them (48 named dimensions, 0 to 1). */
  scores?: Record<string, number>;
  /** The raw emotion string when it was not JSON, so nothing is lost. */
  scoresRaw?: string;
  metadata?: string;
}
interface SavedAudio { status: string; file?: string; checkedAt: string }
interface SavedChat {
  id: string;
  groupId: string;
  startedAt: string | null;
  endedAt: string | null;
  status: string;
  eventCount: number;
  config?: { id: string; version?: number };
  events: SavedEvent[];
  audio?: SavedAudio;
}

/** Every event of one chat, oldest first, with the scores parsed where Hume sent JSON. */
async function fetchChat(chatId: string): Promise<SavedEvent[]> {
  const events: SavedEvent[] = [];
  const page = await client.empathicVoice.chats.listChatEvents(chatId, { pageSize: 100, ascendingOrder: true });
  for await (const e of page) {
    const ev: SavedEvent = { id: e.id, at: iso(e.timestamp), role: String(e.role), type: String(e.type), text: e.messageText ?? "" };
    if (e.emotionFeatures) {
      try { ev.scores = JSON.parse(e.emotionFeatures) as Record<string, number>; } catch { ev.scoresRaw = e.emotionFeatures; }
    }
    if (e.metadata) ev.metadata = e.metadata;
    events.push(ev);
  }
  return events;
}

/** Ask for the chat's reconstructed audio; download it when Hume says it is complete. Returns what to record in the file. */
async function fetchAudio(chatId: string): Promise<SavedAudio> {
  const rec = await client.empathicVoice.chats.getAudio(chatId);
  const checkedAt = new Date().toISOString();
  if (rec.status !== "COMPLETE" || !rec.signedAudioUrl) return { status: rec.status, checkedAt };
  const ext = rec.filename ? path.extname(rec.filename) || ".mp4" : ".mp4";
  const file = path.join(out, `${chatId}${ext}`);
  if (!fs.existsSync(file) || force) {
    const res = await fetch(rec.signedAudioUrl);
    if (!res.ok) return { status: `download failed (${res.status})`, checkedAt };
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return { status: "COMPLETE", file: path.basename(file), checkedAt };
}

async function main(): Promise<void> {
  if (!listOnly) fs.mkdirSync(out, { recursive: true });
  const index: Array<{ id: string; startedAt: string | null; endedAt: string | null; status: string; scoredLines: number; file?: string; audio?: string }> = [];
  let chatsSeen = 0;
  let scoredTotal = 0;
  let audioDone = 0;
  let audioPending = 0;
  const chats = await client.empathicVoice.chats.listChats({ pageSize: 100, ascendingOrder: true });
  for await (const chat of chats) {
    if (only && chat.id !== only) continue;
    chatsSeen += 1;
    const file = path.join(out, `${chat.id}.json`);
    const kept = !force && fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as SavedChat) : null;
    let saved: SavedChat;
    if (listOnly) {
      saved = { id: chat.id, groupId: chat.chatGroupId, startedAt: iso(chat.startTimestamp), endedAt: iso(chat.endTimestamp), status: String(chat.status), eventCount: chat.eventCount ?? 0, events: kept?.events ?? [] };
    } else if (kept && kept.events.length >= (chat.eventCount ?? 0)) {
      saved = kept;
    } else {
      const events = await fetchChat(chat.id);
      saved = {
        id: chat.id,
        groupId: chat.chatGroupId,
        startedAt: iso(chat.startTimestamp),
        endedAt: iso(chat.endTimestamp),
        status: String(chat.status),
        eventCount: chat.eventCount ?? events.length,
        ...(chat.config ? { config: { id: chat.config.id, ...(chat.config.version !== undefined ? { version: chat.config.version } : {}) } } : {}),
        events,
        ...(kept?.audio ? { audio: kept.audio } : {}),
      };
    }
    if (wantAudio && !listOnly && saved.audio?.status !== "COMPLETE") {
      try { saved.audio = await fetchAudio(chat.id); } catch (e) { saved.audio = { status: `error: ${(e as Error).message}`, checkedAt: new Date().toISOString() }; }
    }
    if (saved.audio?.status === "COMPLETE") audioDone += 1; else if (wantAudio) audioPending += 1;
    if (!listOnly) fs.writeFileSync(file, JSON.stringify(saved, null, 2));
    const scored = saved.events.filter((e) => e.scores).length;
    scoredTotal += scored;
    index.push({ id: chat.id, startedAt: saved.startedAt, endedAt: saved.endedAt, status: saved.status, scoredLines: scored, ...(listOnly ? {} : { file: path.basename(file) }), ...(saved.audio ? { audio: saved.audio.file ?? saved.audio.status } : {}) });
    console.log(`${chat.id}  ${saved.startedAt ?? "?"}  ${saved.status}  events ${chat.eventCount ?? "?"}${listOnly ? "" : `  scored lines ${scored}`}${saved.audio ? `  audio ${saved.audio.file ?? saved.audio.status}` : ""}`);
  }
  if (!listOnly) fs.writeFileSync(path.join(out, "index.json"), JSON.stringify(index, null, 2));
  console.log(`\n${chatsSeen} chat${chatsSeen === 1 ? "" : "s"}${listOnly ? "" : `, ${scoredTotal} scored user lines, written to ${out}`}${wantAudio ? `; audio complete ${audioDone}, pending ${audioPending} (run again with --audio for the rest)` : ""}.`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
