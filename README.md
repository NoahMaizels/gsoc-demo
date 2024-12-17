## Two-way Messaging Over GSOC Demo

To get started, create a `.env` file and fill it with the following information:

```ini
# The Bee API endpoint for a full Bee node
BEE_API=http://localhost:1633 
# The batch id for a non-expired mutable postage batch
BATCH_ID=17caba8ae704c356f50cb4f3e14568d3462423448334bd7df032298d88d83bb9
# A 32 byte hex number which matches your own node's overlay up to STORAGE_DEPTH bits (i.e., 4 hex characters for a STORAGE_DEPTH of 16)
OWN_OVERLAY=fe1c000000000000000000000000000000000000000000000000000000000000
# A 32 byte hex number which matches the overlay of the node you wish to message up to STORAGE_DEPTH bits (i.e., 4 hex characters for a STORAGE_DEPTH of 16) 
REMOTE_OVERLAY=7570000000000000000000000000000000000000000000000000000000000000
# A unique id used by both you and the other node you wish to communicate with
GSOC_ID=comments-v1
# Node storage depth, can leave at 16.
STORAGE_DEPTH=16
```

To get started:

```bash
npm install
npm start
```

To start communicating with another node, run the script again somewhere else with the config updated for the other node.  

While both scripts are running for two different full nodes, a communication channel will be opened between the nodes.