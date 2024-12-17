  import { InformationSignal } from '@anythread/gsoc';
  import fs from 'fs';
  import path from 'path';

  // Configuration
  const BEE_API = 'http://localhost:1633';
  const BATCH_ID = '17caba8ae704c356f50cb4f3e14568d3462423448334bd7df032298d88d83bb9';
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

  // Utility: Save GSOC address to file
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
    throw new Error('Invalid GSOC record format: Only "text" and "timestamp" fields are allowed');
  };

  async function sendGsocMessage(payload, description) {
    console.log(`Preparing to send ${description} message...`);

    const informationSignal = new InformationSignal(BEE_API, {
      postage: BATCH_ID,
      consensus: { id: GSOC_ID, assertRecord },
    });

    let resourceId;
    let gsocAddress;

    // Check if a GSOC address already exists for the inputs
    const existingEntry = findGsocAddress(TARGET_OVERLAY, STORAGE_DEPTH, GSOC_ID);

    if (existingEntry) {
      console.log('Using existing GSOC address from file.');
      resourceId = Buffer.from(existingEntry.resourceId, 'hex');
      gsocAddress = existingEntry.gsocAddress;
    } else {
      console.log('No existing GSOC address found. Mining a new one...');
      const minedResult = await informationSignal.mine(TARGET_OVERLAY, STORAGE_DEPTH);
      resourceId = minedResult.resourceId;
      gsocAddress = uint8ArrayToHex(minedResult.gsocAddress);

      // Save the new address
      saveGsocAddress({
        gsocId: GSOC_ID,
        targetOverlay: TARGET_OVERLAY,
        storageDepth: STORAGE_DEPTH,
        resourceId: uint8ArrayToHex(resourceId),
        gsocAddress,
      });
      console.log('New GSOC address saved to file.');
    }

    try {
      const soc = await informationSignal.write(payload, resourceId);
      console.log(`Message sent successfully! SOC Address: ${uint8ArrayToHex(soc.address())}`);
    } catch (error) {
      console.error(`Failed to send ${description} message:`, error.message);
    }
  }

  async function main() {
    const validPayload = { text: 'Hello, GSOC!', timestamp: Date.now() };
    const invalidPayload = { text: 'This is message is missing the required "timestamp" value'};

    console.log('Sending valid message...');
    await sendGsocMessage(validPayload, 'valid');

    console.log('Sending invalid message...');
    await sendGsocMessage(invalidPayload, 'invalid');

    console.log('Exiting after sending messages...');
  }

  main().catch(err => console.error('Error:', err.message));
