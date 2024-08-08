import { Command } from "commander";
import { listenOnNewListings, listenOnTrades } from "./listen";
import { grabToken } from "./token";
import { Connection, Commitment, LogsFilter, PublicKey } from "@solana/web3.js";

const program = new Command();

program
  .name("pump-ts")
  .description("CLI interface for pump related stuff in TypeScript")
  .version("1.0.0");

program
  .command("grab-token")
  .description("Grab token information for a given mint address")
  .argument("<mint>", "The mint address of the token")
  .action(async (mint: string) => {
    console.log(`Grabbing token information for mint: ${mint}`);
    try {
      const result = await grabToken(mint);
      console.log("Token information:", result);
    } catch (error) {
      console.error("Error grabbing token:", error);
    }
  });

program.command("listen-logs").action(async () => {
  if (!process.env.RPC_URL) {
    console.error("RPC_URL environment variable is required");
    return;
  }
  let currentSlot = 0;
  const conn = new Connection(process.env.RPC_URL);
  conn.onLogs(
    new PublicKey("TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM"),
    (logs, context) => {
      console.log({
        onSlot: context.slot,
        currentSlot,
        window: context.slot - currentSlot,
      });
    },
    "processed",
  );
  conn.onSlotChange((slot) => {
    currentSlot = slot.slot;
  });
});

program.command("listen-program").action(async () => {
  if (!process.env.RPC_URL) {
    console.error("RPC_URL environment variable is required");
    return;
  }
  const conn = new Connection(process.env.RPC_URL);
  conn.onProgramAccountChange(
    new PublicKey("TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM"),
    (acc) => {
      console.log(acc);
    },
    { commitment: "processed" },
  );
});

program
  .command("listen")
  .option("--sniper-url <url>", "sniper url", "http://sniper:6969")
  .description("Listen for new listings")
  .action(async ({ sniperUrl }) => {
    console.log("Listening for new listings");
    try {
      await listenOnNewListings(sniperUrl);
    } catch (error) {
      console.error(error);
    }
  });

program
  .command("listen-trades")
  .description("Listen on new pump trades")
  .action(async () => {
    console.log("Listening for new trades");
    try {
      await listenOnTrades();
    } catch (error) {
      console.error(error);
    }
  });

program
  .command("health")
  .description("check if the pump service is healthy")
  .option("--sniper-url <string>", "sniper url", "http://sniper:6969")
  .action(async ({ sniperUrl }) => {
    try {
      const url = `${sniperUrl}/health`;
      const res = await fetch(url);
      const data = await res.json();
      console.log(data);
    } catch (error) {
      console.error(error);
    }
  });

program.command("bench-pumpportal").action(async () => {
  const ws = new WebSocket("wss://pumpportal.fun/api/data");

  ws.onopen = () => {
    // Subscribing to token creation events
    let payload = {
      method: "subscribeNewToken",
    };
    ws.send(JSON.stringify(payload));
  };
  ws.onmessage = (event) => {
    console.log(JSON.parse(event.data)?.mint, Date.now());
  };
});

await (async function main() {
  await program.parseAsync(process.argv);
})();
