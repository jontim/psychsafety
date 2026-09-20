import { describe, expect, it } from "vitest";
import { candidateNames, resolveVoices } from "../voices.js";

const member = (id: string, name: string, voiceName?: string) => ({ id, name, voice: { name: voiceName, description: "x" } });

describe("candidateNames", () => {
  it("tries the pack name first, then the first name, the id, and the Shadow Fell prefix", () => {
    expect(candidateNames(member("tav", "Tavian Larkvale", "Tavian"))).toEqual([
      "Tavian", "Tav", "Tavian Larkvale", "Shadow Fell Tavian", "Shadow Fell Tav",
    ]);
  });
  it("uses the bare label for characters called The Something", () => {
    expect(candidateNames(member("watch-captain", "The Watch Captain", "Shadow Fell Watch Captain"))).toEqual([
      "Shadow Fell Watch Captain", "Watch Captain",
    ]);
  });
  it("still derives aliases when the pack names no voice", () => {
    expect(candidateNames(member("sahir", "Sahir Anvar"))).toEqual(["Sahir", "Sahir Anvar", "Shadow Fell Sahir"]);
  });
});

describe("resolveVoices", () => {
  const library = ["Soraya", "navid", "Shadow Fell Visitor", "Tavian", "Shadow  Fell Watch-Captain"];
  const cast = [
    member("soraya", "Soraya Anvar", "Soraya"),
    member("navid", "Navid Qasran", "Navid"),
    member("tav", "Tavian Larkvale", "Shadow Fell Tav"),
    member("visitor", "The Carriage Visitor", "Shadow Fell Visitor"),
    member("watch-captain", "The Watch Captain", "Shadow Fell Watch Captain"),
    member("sahir", "Sahir Anvar"),
  ];
  const rows = Object.fromEntries(resolveVoices(cast, library).map((r) => [r.id, r]));

  it("matches the pack name exactly, ignoring case", () => {
    expect(rows.soraya).toMatchObject({ resolved: "Soraya", via: "pack name", designed: false });
    expect(rows.navid).toMatchObject({ resolved: "navid", via: "pack name", designed: false });
  });
  it("falls through to an alias when the pack name is not in the library", () => {
    expect(rows.tav).toMatchObject({ resolved: "Tavian", via: 'alias "Tavian"', designed: false });
  });
  it("ignores spacing and punctuation differences", () => {
    expect(rows["watch-captain"]).toMatchObject({ resolved: "Shadow  Fell Watch-Captain", designed: false });
  });
  it("marks a character with no library voice as designed from the description", () => {
    expect(rows.sahir?.designed).toBe(true);
    expect(rows.sahir?.resolved).toBeUndefined();
  });
  it("never matches one character to another's voice", () => {
    expect(rows.visitor?.resolved).toBe("Shadow Fell Visitor");
    expect(new Set(Object.values(rows).map((r) => r.resolved).filter(Boolean)).size).toBe(5);
  });
});
