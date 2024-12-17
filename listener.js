import { InformationSignal } from '@anythread/gsoc';
import fs from 'fs';
import path from 'path';


// Configuration
const BEE_API = 'http://localhost:1633';
const GSOC_ID = 'comments-v1';
const TARGET_OVERLAY = '7570000000000000000000000000000000000000000000000000000000000000';
const STORAGE_DEPTH = 16; // Number of leading bits to match

// Utility: Convert Uint8Array to Hex String
function uint8ArrayToHex(uint8Array) {
  return Array.from(uint8Array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// File path for saving mined GSOC addresses
const GSOC_ADDRESSES_FILE = path.resolve('gsocAddresses.json');

// Utility: Load GSOC addresses from file
function loadGsocAddresses() {
  if (!fs.existsSync(GSOC_ADDRESSES_FILE)) return [];
  const data = fs.readFileSync(GSOC_ADDRESSES_FILE, 'utf-8');
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Utility: Save GSOC addresses to file
function saveGsocAddress(entry) {
  const addresses = loadGsocAddresses();
  addresses.push(entry);
  fs.writeFileSync(GSOC_ADDRESSES_FILE, JSON.stringify(addresses, null, 2), 'utf-8');
}

// Check if a GSOC address already exists for the given inputs
function findGsocAddress(targetOverlay, storageDepth, gsocId) {
  const addresses = loadGsocAddresses();
  return addresses.find(
    entry =>
      entry.targetOverlay === targetOverlay &&
      entry.storageDepth === storageDepth &&
      entry.gsocId === gsocId
  );
}



// Validation function for GSOC messages
const assertRecord = value => {
  if (typeof value === 'object' && value !== null && 'text' in value && 'timestamp' in value) return;
  throw new Error('Invalid GSOC record format: "text" and "timestamp" fields are required');
};

async function createGsocListener() {
  const informationSignal = new InformationSignal(BEE_API, {
    consensus: { id: GSOC_ID, assertRecord },
  });

  // Step 1: Check for existing GSOC address
  const existingEntry = findGsocAddress(TARGET_OVERLAY, STORAGE_DEPTH, GSOC_ID);

  let resourceId;
  let gsocAddress;

  if (existingEntry) {
    console.log('Using existing GSOC address from file.');
    resourceId = Buffer.from(existingEntry.resourceId, 'hex');
    gsocAddress = existingEntry.gsocAddress;
  } else {
    console.log('No existing GSOC address found. Mining a new one...');
    const minedResult = await informationSignal.mine(TARGET_OVERLAY, STORAGE_DEPTH);
    resourceId = minedResult.resourceId;
    gsocAddress = uint8ArrayToHex(minedResult.gsocAddress);

    // Step 2: Save the mined GSOC address to file
    saveGsocAddress({
      gsocId: GSOC_ID,
      targetOverlay: TARGET_OVERLAY,
      storageDepth: STORAGE_DEPTH,
      resourceId: uint8ArrayToHex(resourceId),
      gsocAddress,
    });

    console.log('New GSOC address saved to file.');
  }

  console.log(`Resource ID (hex): ${uint8ArrayToHex(resourceId)}`);
  console.log(`Subscription GSOC Address: ${gsocAddress}`);

  // Step 3: Subscribe to the GSOC address
  const subscription = informationSignal.subscribe(
    {
      onMessage: payload => console.log('Received GSOC update:', payload),
      onError: err => console.error('Error in subscription:', err),
    },
    resourceId
  );

  console.log('Listening for GSOC updates...');
}

createGsocListener().catch(err => console.error('Error:', err.message));