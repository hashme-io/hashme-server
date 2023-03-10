import config from "$config";
import { sleep } from "$lib/utils";
import { createClient } from "redis";
import { warn } from "$lib/logging";

export const db = createClient({ url: config.db });
await db.connect();
export default db;

export let g = async k => {
  let v = await db.get(k);
  try {
    return JSON.parse(v);
  } catch (e) {
    return v;
  }
};
export let s = (k, v) => {
  if (k === "user:null" || k === "user:undefined") {
    warn("###### NULL USER #######");
    console.trace();
  }
  db.set(k, JSON.stringify(v));
};

let retries = {};
export let t = async (k, f) => {
  try {
    await db.watch(k);
    await f(await db.get(k), db);
  } catch (err) {
    if (!err.message.includes("watch")) throw err;

    let r = retries[k] || 0;
    retries[k] = r + 1;

    if (r < 10) {
      await sleep(100);
      await t(k, f);
    } else {
      delete retries[k];
      throw new Error("unable to obtain lock");
    }
  }

  delete retries[k];
};
