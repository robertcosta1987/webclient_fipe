import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeCsv, toCsv, exportToCsv } from "./csv";

test("escapeCsv quotes fields with comma/quote/newline and doubles quotes", () => {
  assert.equal(escapeCsv("abc"), "abc");
  assert.equal(escapeCsv("a,b"), '"a,b"');
  assert.equal(escapeCsv('he said "hi"'), '"he said ""hi"""');
  assert.equal(escapeCsv("line1\nline2"), '"line1\nline2"');
  assert.equal(escapeCsv(null), "");
  assert.equal(escapeCsv(undefined), "");
  assert.equal(escapeCsv(42), "42");
  assert.equal(escapeCsv({ a: 1 }), '"{""a"":1}"');
});

test("toCsv emits a header from the union of keys, in first-seen order", () => {
  const csv = toCsv([{ a: 1, b: 2 }, { a: 3, c: 4 }]);
  assert.equal(csv, "a,b,c\n1,2,\n3,,4");
  assert.equal(toCsv([]), "");
});

test("exportToCsv banners each section and notes empty ones", () => {
  const doc = exportToCsv({
    account: { id: "u1", email: "a@b.com" },
    vehicles: [{ placa: "ABC1D23" }],
    consultas: [],
    nada: null,
  });
  assert.match(doc, /# account\nid,email\nu1,a@b\.com/);
  assert.match(doc, /# vehicles\nplaca\nABC1D23/);
  assert.match(doc, /# consultas\n\(vazio\)/);
  assert.match(doc, /# nada\n\(vazio\)/);
});
