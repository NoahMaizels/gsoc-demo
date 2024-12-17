import { InformationSignal } from '@anythread/gsoc';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Configuration loaded from .env
const BEE_API = process.env.BEE_API;
const BATCH_ID = process.env.BATCH_ID;
const OWN_OVERLAY = process.env.OWN_OVERLAY;
const REMOTE_OVERLAY = process.env.REMOTE_OVERLAY;
const GSOC_ID = process.env.GSOC_ID;
const STORAGE_DEPTH = parseInt(process.env.STORAGE_DEPTH, 10);

// File path for saving mined GSOC results
const MINED_RESULTS_FILE = path.resolve('minedResults.json');

// Utility Functions
function uint8ArrayToHex(uint8Array) {
  return Array.from(uint8Array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function hexToUint8Array(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return new Uint8Array(bytes);
}

function loadMinedResults() {
  if (!fs.existsSync(MINED_RESULTS_FILE)) {
    fs.writeFileSync(MINED_RESULTS_FILE, '[]', 'utf-8');
    return [];
  }

  const data = fs.readFileSync(MINED_RESULTS_FILE, 'utf-8');
  try {
    return JSON.parse(data) || [];
  } catch (err) {
    console.error('Invalid JSON in minedResults file. Resetting file...');
    fs.writeFileSync(MINED_RESULTS_FILE, '[]', 'utf-8');
    return [];
  }
}

function saveMinedResult(entry) {
  const results = loadMinedResults();
  results.push(entry);
  fs.writeFileSync(MINED_RESULTS_FILE, JSON.stringify(results, null, 2), 'utf-8');
}

function findMinedResult(gsocId, storageDepth, targetOverlay) {
  return loadMinedResults().find(
    entry =>
      entry.inputs.gsocId === gsocId &&
      entry.inputs.storageDepth === storageDepth &&
      entry.inputs.targetOverlay === targetOverlay
  );
}

const assertRecord = value => {
  if (typeof value === 'object' && 'text' in value && 'timestamp' in value) return;
  throw new Error('Invalid GSOC format. Only "text" and "timestamp" allowed.');
};

// Get or mine GSOC
async function getOrMineGsoc(informationSignal, targetOverlay) {
  const existingEntry = findMinedResult(GSOC_ID, STORAGE_DEPTH, targetOverlay);
  if (existingEntry) {
    return hexToUint8Array(existingEntry.resourceId);
  }

  console.log(`Mining GSOC for overlay: ${targetOverlay}...`);
  const result = await informationSignal.mine(targetOverlay, STORAGE_DEPTH);

  const minedEntry = {
    resourceId: uint8ArrayToHex(result.resourceId),
    gsocAddress: uint8ArrayToHex(result.gsocAddress),
    inputs: {
      gsocId: GSOC_ID,
      storageDepth: STORAGE_DEPTH,
      targetOverlay: targetOverlay,
    },
  };

  saveMinedResult(minedEntry);
  console.log(`New GSOC mined. GSOC Address: ${minedEntry.gsocAddress}`);

  return result.resourceId;
}

// Listener
async function startListener(resourceId) {
  const informationSignal = new InformationSignal(BEE_API, { consensus: { id: GSOC_ID, assertRecord } });

  const gsocEntry = findMinedResult(GSOC_ID, STORAGE_DEPTH, OWN_OVERLAY);
  console.log(`Listening for messages on GSOC Address: ${gsocEntry.gsocAddress}`);

  // Handle message prompts
  informationSignal.subscribe(
    {
      onMessage: payload => {
        process.stdout.write('\u001b[2K\u001b[G'); // Clear current line
        console.log('\nReceived message:', payload);
        process.stdout.write('Enter your message: '); // Reprompt cleanly
      },
      onError: err => console.error('Error:', err),
    },
    resourceId
  );

  console.log('Listening for messages in your neighborhood...');
}

// Messenger
async function sendMessage(resourceId, text) {
  const informationSignal = new InformationSignal(BEE_API, {
    postage: BATCH_ID,
    consensus: { id: GSOC_ID, assertRecord },
  });

  const payload = { text, timestamp: Date.now() };
  await informationSignal.write(payload, resourceId);

  process.stdout.write('\u001b[2K\u001b[G'); // Clear current prompt
  console.log('Message sent.');
  process.stdout.write('Enter your message: '); // Reprompt cleanly
}

// User Input Loop
function startInputLoop(sendMessageFunction) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write('Enter your message: ');

  rl.on('line', async line => {
    const input = line.trim();
    if (input.toLowerCase() === 'exit') {
      console.log('Exiting...');
      rl.close();
      process.exit(0);
    }
    await sendMessageFunction(input);
  });

  rl.on('SIGINT', () => {
    console.log('\nSIGINT received. Cleaning up and exiting...');
    rl.close();
    process.exit(0);
  });
}

// Main
async function main() {
  console.log('Initializing GSOC setup for both overlays...');

  const informationSignal = new InformationSignal(BEE_API, { consensus: { id: GSOC_ID, assertRecord } });

  const ownResourceId = await getOrMineGsoc(informationSignal, OWN_OVERLAY);
  const remoteResourceId = await getOrMineGsoc(informationSignal, REMOTE_OVERLAY);

  console.log('Starting GSOC listener...');
  await startListener(ownResourceId);

  console.log('Ready to send messages. Type "exit" to quit.');
  startInputLoop(text => sendMessage(remoteResourceId, text));
}

main().catch(err => console.error('Error:', err));
