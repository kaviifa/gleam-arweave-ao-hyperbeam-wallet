import { describe, expect, it } from "vitest";
import { HARMLESS_TAGS, isHarmlessTag, otherTags } from "./other-tags";
import { readAoTransferMessage } from "./transfer-message";
import { readL1TokenTransfer } from "./l1-transfer";

const PROCESS = "p".repeat(43);
const RECIPIENT = "r".repeat(43);

const aoTransfer = [
  { name: "Data-Protocol", value: "ao" },
  { name: "Variant", value: "ao.TN.1" },
  { name: "Type", value: "Message" },
  { name: "Action", value: "Transfer" },
  { name: "Recipient", value: RECIPIENT },
  { name: "Quantity", value: "42" },
  { name: "Content-Type", value: "text/plain" },
  { name: "SDK", value: "aoconnect" },
];

/**
 * Shapes past advisories turned on: each either fails to read as a clean
 * transfer, or reads as one with the extra tag counted beside it.
 */
describe("otherTags", () => {
  it("counts nothing beside the transfer Gleam itself sends", () => {
    expect(readAoTransferMessage({ target: PROCESS, tags: aoTransfer })?.kind).toBe("transfer");
    expect(otherTags(aoTransfer, "ao")).toEqual([]);
  });

  it("counts neither variant, testnet's or HyperBEAM's, but any other", () => {
    const withVariant = (value: string) => aoTransfer.map((tag) => (tag.name === "Variant" ? { ...tag, value } : tag));
    expect(otherTags(withVariant("ao.N.1"), "ao")).toEqual([]);
    expect(otherTags(withVariant("ao.N.2"), "ao")).toEqual([{ name: "Variant", value: "ao.N.2" }]);
  });

  it("counts a tag the AO reader does not model", () => {
    const tags = [...aoTransfer, { name: "X-Forward-To", value: "q".repeat(43) }];
    expect(readAoTransferMessage({ target: PROCESS, tags })?.kind).toBe("transfer");
    expect(otherTags(tags, "ao")).toEqual([{ name: "X-Forward-To", value: "q".repeat(43) }]);
  });

  it("counts Assign-To beside an AO transfer", () => {
    const tags = [...aoTransfer, { name: "Assign-To", value: "q".repeat(43) }];
    expect(otherTags(tags, "ao").map((tag) => tag.name)).toEqual(["Assign-To"]);
  });

  it("never treats a tag name the readers act on as harmless", () => {
    // `HARMLESS_TAGS` is keyed by lowercase name, and `isHarmlessTag`
    // lowercases before it looks up, so a reader-known name here would
    // make the tag vanish from the count beside a transfer's headline
    // and from the tiers — the one place a token-moving tag must show.
    for (const name of ["action", "recipient", "quantity", "assign-to"]) {
      expect(Object.hasOwn(HARMLESS_TAGS, name)).toBe(false);
      expect(isHarmlessTag({ name, value: "x" })).toBe(false);
      expect(isHarmlessTag({ name: name.toUpperCase(), value: "x" })).toBe(false);
    }
  });

  it("never lets a recased or repeated transfer tag read as clean", () => {
    const recased = aoTransfer.map((tag) => (tag.name === "Recipient" ? { ...tag, name: "recipient" } : tag));
    const repeated = [...aoTransfer, { name: "Quantity", value: "1" }];
    expect(readAoTransferMessage({ target: PROCESS, tags: recased })?.kind).toBe("unreadable");
    expect(readAoTransferMessage({ target: PROCESS, tags: repeated })?.kind).toBe("unreadable");
  });

  it("counts an L1 transfer's extra tags and leaves its own in any case", () => {
    const tags = [
      { name: "Action", value: "Transfer" },
      { name: "RECIPIENT", value: RECIPIENT },
      { name: "quantity", value: "1" },
      { name: "App-Name", value: "Bazar" },
    ];
    expect(readL1TokenTransfer({ target: PROCESS, quantity: "0", data_size: "0", tags })?.kind).toBe("transfer");
    expect(otherTags(tags, "l1")).toEqual([{ name: "App-Name", value: "Bazar" }]);
  });

  it("counts a protocol tag with a value AO routes on", () => {
    const tags = [...aoTransfer.filter((tag) => tag.name !== "Type"), { name: "Type", value: "Process" }];
    expect(otherTags(tags, "ao")).toEqual([{ name: "Type", value: "Process" }]);
  });

  it("counts every tag but the protocol ones on a plain transaction", () => {
    const tags = [
      { name: "Content-Type", value: "text/plain" },
      { name: "Action", value: "Transfer" },
    ];
    expect(otherTags(tags, "plain")).toEqual([{ name: "Action", value: "Transfer" }]);
  });
});
