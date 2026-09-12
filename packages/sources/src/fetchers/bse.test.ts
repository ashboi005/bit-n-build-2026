import { expect, test } from "bun:test";

import { parseQuote } from "./bse";

test("accepts BSE's current quote payload without the retired Header.ScripCode field", () => {
  const quote = parseQuote({
    CurrRate: { LTP: "1258.00", Chg: "-17.00", PcChg: "-1.33" },
    Header: {
      PrevClose: "1275.00",
      Open: "1268.10",
      High: "1268.15",
      Low: "1253.20",
      Ason: "11 Sep 26 | 16:00",
    },
    Cmpname: { FullN: "Reliance Industries Ltd" },
  });

  expect(quote.CurrRate.LTP).toBe("1258.00");
  expect(quote.Header.PrevClose).toBe("1275.00");
});
