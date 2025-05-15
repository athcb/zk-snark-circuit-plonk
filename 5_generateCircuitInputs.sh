#!/bin/bash

echo "Creating a file with the poseidon-hashed leaves from the members address list..."
node scripts/createHashedLeaves.js


echo "Generating the merkle tree and dummy input values for circuit..."
node scripts/createMerkleTreeAndInput.js

echo "-----------------"
echo "- Step 5...Done -"
echo "-----------------"
