import { createClient } from "@repo/redis_data";
import {
  CONSUMER_ID,
  GROUP_NAME,
  READ_COUNT,
  STREAM_NAME,
  parseEvent,
  saveEvent,
  type StreamMessage,
} from "./persistence";

type StreamResponse = {
  name: string;
  messages: StreamMessage[];
}[];

const redis = await createClient();

async function readPendingMessages(){
  return (await redis.xReadGroup(
    GROUP_NAME,
    CONSUMER_ID,
    [{key: STREAM_NAME , id : "0"}],
    {COUNT: READ_COUNT}
  ))as StreamResponse | null;
}

async function readNewMessages(){
  return (await redis.xReadGroup(
    GROUP_NAME,
    CONSUMER_ID,
    [{key:STREAM_NAME , id:">"}], 
    {BLOCK:0 , COUNT:READ_COUNT},
  )) as StreamResponse | null
}
async function processResponse(response:StreamResponse | null){
  if(!response) return false
  let processedany = false;
  for(const stream of response){
    for(const message of stream.messages){
      processedany = true;
      await processMessage(message)
    }
  }
  return processedany;
}
async function drainpendingmessages(){
  while(true){
    const response = await readPendingMessages();
    const processedAny = await processResponse(response);
    if(!processedAny){
      break;
    }
  }
}
async function createConsumerGroup() {
  try {
    await redis.xGroupCreate(STREAM_NAME, GROUP_NAME, "0", { MKSTREAM: true });
    console.log("db poller consumer group created");
  } catch (error) {
    if (String(error).includes("BUSYGROUP")) {
      console.log("db poller consumer group already exists");
      return;
    }

    throw error;
  }
}

async function processMessage(message: StreamMessage) {
  const data = message.message.data;
  if (!data) {
    console.error("db poller message has no data:", message.id);
    return;
  }

  try {
    const event = parseEvent(data);

    await saveEvent(event); // db process that event 
    await redis.xAck(STREAM_NAME, GROUP_NAME, message.id); 

    console.log("db poller saved event:", message.id);
  } catch (error) {
    console.error("db poller failed to save event:", message.id, error);
  }
}

async function pollForever() {
  await drainpendingmessages();
  while (true) {
    const response = (await redis.xReadGroup(
      GROUP_NAME,
      CONSUMER_ID,
      [{ key: STREAM_NAME, id: ">" }],
      { BLOCK: 0, COUNT: READ_COUNT },
    )) as StreamResponse | null;

    if (!response) continue;

    for (const stream of response) {
      for (const message of stream.messages) {
        await processMessage(message);
      }
    }
  }
}

await createConsumerGroup();
await pollForever();
