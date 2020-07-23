import { h, render } from "preact";
import { AppView } from "./components/app";
import { AudioInterface } from "./lib/audioInterface";
import * as IDB from "idb-keyval";
import { getInitialState } from "./ducks/reducer";
import { DateUtils } from "./utils/date";

if ("serviceWorker" in navigator) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  navigator.serviceWorker.register("/webpushr-sw.js");
}

console.log(DateUtils.formatYYYYMMDDHHMM(Date.now()));
const client = window.fetch.bind(window);
const audio = new AudioInterface();
IDB.get("liftosaur").then(async (loadedData) => {
  const initialState = await getInitialState(client, loadedData as string | undefined);
  render(<AppView initialState={initialState} client={client} audio={audio} />, document.getElementById("app")!);
});
