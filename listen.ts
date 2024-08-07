import { PUMP_WEBSOCKET_URL } from "./consts";
import { NewCoinCreatedSchema } from "./new-coin";
import { TradeCreatedSchema } from "./trade";

enum MessageType {
  TRADE_CREATED = `42["tradeCreated"`,
  COIN_CREATED = `42["newCoinCreated"`,
}

interface PumpBuyRequest {
  mint: string;
  bonding_curve: string;
  associated_bonding_curve: string;
  virtual_token_reserves: string;
  virtual_sol_reserves: string;
  real_token_reserves: string;
  real_sol_reserves: string;
}

function _addBaseHandlers(ws: WebSocket) {
  ws.onopen = function () {
    console.log("Connection established");
    ws.send("40");
  };

  ws.onclose = function () {
    console.log("Connection closed");
  };

  ws.onerror = function (event) {
    console.log("Error: " + event);
  };
}

export async function listenOnTrades() {
  const ws = new WebSocket(PUMP_WEBSOCKET_URL);
  _addBaseHandlers(ws);

  ws.onmessage = function (event) {
    let data = event.data as string;
    if (data == "2") {
      ws.send("3");
      console.log("Heartbeat sent");
    } else if (data.startsWith(MessageType.TRADE_CREATED)) {
      // dont do anything, we dont care about trades for now
      let jsonParsable = data
        .replace(`42["tradeCreated",`, "")
        .replace("]", "");
      let trade = TradeCreatedSchema.parse(JSON.parse(jsonParsable));
      console.log({
        signature: trade.signature,
        sol_amount: trade.sol_amount,
        token_amount: trade.token_amount,
        is_buy: trade.is_buy,
        timestamp: trade.timestamp,
        name: trade.name,
        symbol: trade.symbol,
        usd_market_cap: trade.usd_market_cap,
      });
    }
  };
}

export async function listenOnNewListings(sniperUrl: string) {
  const ws = new WebSocket(PUMP_WEBSOCKET_URL);
  _addBaseHandlers(ws);

  ws.onmessage = function (event) {
    let data = event.data as string;
    if (data == "2") {
      ws.send("3");
      console.log("Heartbeat sent");
    } else if (data.startsWith(MessageType.COIN_CREATED)) {
      let jsonParsable = data
        .replace(`42["newCoinCreated",`, "")
        .replace("]", "");
      let coin = NewCoinCreatedSchema.parse(JSON.parse(jsonParsable));
      const msg = {
        mint: coin.mint,
        x: coin.twitter,
        websites: coin.website,
        telegram: coin.telegram,
        at: new Date(coin.created_timestamp).toLocaleString(),
        current: new Date().toLocaleString(),
      };
      console.debug(msg);
      console.debug(
        `got info ${Date.now() - coin.created_timestamp} ms after creation`,
      );
      // logs might be skipped to see later if that brings speed
      // improvement, both rust and ts service
      if (msg.at !== msg.current) {
        // red X emoji in the log for skip
        console.debug("❌Too late");
      }
      // skip if token doesnt have telegram or twitter
      // there is so many tokens, I might just filter like this
      if (!coin.website || !coin.telegram || !coin.twitter) {
        console.debug("❌No telegram or twitter or website, skipping");
        return;
      }
      // check if set of the three is not a single element
      if (new Set([coin.website, coin.telegram, coin.twitter]).size === 1) {
        console.debug("❌Website, telegram and twitter are the same, skipping");
        return;
      }
      console.debug("✅Token has telegram, twitter and website, on time too!");
      const pumpBuyRequest: PumpBuyRequest = {
        mint: coin.mint,
        bonding_curve: coin.bonding_curve,
        associated_bonding_curve: coin.associated_bonding_curve,
        virtual_token_reserves: String(coin.virtual_token_reserves),
        virtual_sol_reserves: String(coin.virtual_sol_reserves),
        real_token_reserves: String(coin.real_token_reserves),
        real_sol_reserves: String(coin.real_sol_reserves),
      };
      const url = `${sniperUrl}/pump-buy`;
      fetch(url, {
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify(pumpBuyRequest),
      })
        .then((_) => {})
        .catch((error) => {
          console.error(url, error);
        });
    }
  };
}
