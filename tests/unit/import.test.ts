import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readSpreadsheet } from "@/lib/import/spreadsheet";
import { classify, detectColumns, importNote, nameWords, samePerson, toContacts, usablePhone } from "@/lib/import/contacts";
import { firstName, usernameBase } from "@/lib/identity-utils";

const xlsx = readFileSync("tests/fixtures/contacts-sample.xlsx");

describe("reading contact lists", () => {
  it("reads every sheet of an .xlsx file (text, numbers, blanks) without any library", () => {
    const sheets = readSpreadsheet("contacts-sample.xlsx", xlsx);
    expect(sheets.map((s) => s.name)).toEqual(["Members", "Notes"]);
    expect(sheets[0].rows[0]).toEqual(["#", "Name", "Gender", "Phone", "Alt Phone", "Address", "Source", "Notes", "Needs checking"]);
    expect(sheets[0].rows[2][1]).toBe("Pst. Daniel Bassey");
    expect(sheets[0].rows[7][3]).toBe("8091110003"); // stored as a number in Excel
  });

  it("reads CSV (quotes, commas, semicolons) and refuses old .xls files", () => {
    const [csv] = readSpreadsheet("list.csv", Buffer.from('Name,Phone,Notes\n"Okafor, Grace",08031234567,"Said ""Amen"""\n\nAda Obi,0803 000 1111,\n'));
    expect(csv.rows).toEqual([["Name", "Phone", "Notes"], ["Okafor, Grace", "08031234567", 'Said "Amen"'], ["Ada Obi", "0803 000 1111", ""]]);
    expect(readSpreadsheet("list.csv", Buffer.from("Name;Phone\nAda;0803\n"))[0].rows[1]).toEqual(["Ada", "0803"]);
    expect(() => readSpreadsheet("old.xls", Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))).toThrow(/old Excel/);
    expect(() => readSpreadsheet("bad.xlsx", Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(40)]))).toThrow(/couldn't read that Excel file/);
  });

  it("finds the columns by their headings and turns rows into contacts", () => {
    const rows = readSpreadsheet("contacts-sample.xlsx", xlsx)[0].rows;
    const { headerRow, mapping } = detectColumns(rows);
    expect(headerRow).toBe(0);
    expect(mapping).toEqual({ name: 1, gender: 2, phone: 3, altPhone: 4, address: 5, source: 6, notes: 7, needsChecking: 8 });
    const contacts = toContacts(rows, headerRow, mapping);
    expect(contacts).toHaveLength(7);
    expect(contacts[3]).toMatchObject({ line: 5, name: "Tunde Bakare", phone: "+2348091110002", altPhone: "+2347031110002", gender: "male", needsChecking: true, source: "First-timer slip" });
    expect(contacts[5]).toMatchObject({ name: "Ngozi Eze", phone: null, gender: null });
    expect(contacts[6].phone).toBe("+2348091110003");
    expect(detectColumns([["First name", "Surname", "Mobile number", "E-mail"]]).mapping).toEqual({ firstName: 0, lastName: 1, phone: 2, email: 3 });
    expect(usablePhone("12345")).toBeNull();
    expect(usablePhone("8.09111E+09")).toBe("+2348091110000");
  });
});

describe("deciding who's new", () => {
  it("matches names without titles and initials", () => {
    expect(nameWords("Pst. Umanuwa D. Caleb")).toEqual(["umanuwa", "caleb"]);
    expect(samePerson("Umanuwa Caleb", "Pst. Umanuwa D. Caleb")).toBe(true);
    expect(samePerson("Engr. Mrs. Uju Okwuosa Caleb", "Pst. Umanuwa D. Caleb")).toBe(false);
    expect(usernameBase("Pst. Umanuwa D. Caleb")).toBe("flagumanuwa");
    expect(usernameBase("Engr. Mrs. Uju Okwuosa Caleb")).toBe("flaguju");
    expect(firstName("Pst. Umanuwa D. Caleb")).toBe("Umanuwa");
    expect(firstName("Grace Okafor")).toBe("Grace");
    // A one-letter spelling difference is still the same person; different first names are not.
    expect(samePerson("Chileme Caleb", "Chilime Caleb")).toBe(true);
    expect(samePerson("Chidi Okafor", "Chika Okafor")).toBe(false);
    expect(samePerson("Favour", "Favor")).toBe(true);
    expect(samePerson("Ada Obi", "Adi Obi")).toBe(false); // short words must match exactly
  });

  it("skips people already in the database, links family numbers, and drops repeats", () => {
    const rows = readSpreadsheet("contacts-sample.xlsx", xlsx)[0].rows;
    const d = detectColumns(rows);
    const decided = classify(toContacts(rows, d.headerRow, d.mapping), [
      { id: "g", full_name: "Grace Okafor", normalized_phone: "+2348031234567", owner: true },
      { id: "h", full_name: "Halima Musa", normalized_phone: "+2347000000000", owner: true } // same full name, other number
    ]);
    expect(decided.map((r) => [r.name, r.decision.status])).toEqual([
      ["Grace Okafor", "existing"], ["Pst. Daniel Bassey", "new"], ["Mrs. Ifeoma Bassey", "shares"], ["Tunde Bakare", "new"],
      ["Tunde Bakare", "duplicate"], ["Ngozi Eze", "no_phone"], ["Halima Musa", "existing"]
    ]);
    expect(decided[2].decision).toMatchObject({ ownerName: "Pst. Daniel Bassey", ownerLine: 3 });
    expect(decided[4].decision).toMatchObject({ ofLine: 5 });
    expect(importNote(decided[3], "list.xlsx")).toBe("Imported from list.xlsx (First-timer slip). Other phone: +2347031110002. Interested: Yes ⚠️ Marked “needs checking” in the list.");
  });

  it("a number already used by a registered member makes a new name a family member", () => {
    const decided = classify([{ line: 2, name: "Uju Caleb", phone: "+2347067423634", altPhone: null, gender: "female", address: null, email: null, birthday: null, notes: null, source: null, needsChecking: false }],
      [{ id: "p", full_name: "Umanuwa Caleb", normalized_phone: "+2347067423634", owner: true }]);
    expect(decided[0].decision).toEqual({ status: "shares", ownerName: "Umanuwa Caleb", ownerId: "p", ownerLine: null });
  });
});
