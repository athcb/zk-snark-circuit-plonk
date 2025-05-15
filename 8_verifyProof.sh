#!/bin/bash

echo "--------------------------------"
echo "Verifying the proof off-chain..."
echo "--------------------------------"
snarkjs plonk verify build/membership-circuit/verification_key.json \
                     build/membership-circuit/public.json \
                     build/membership-circuit/proof.json

#echo "--------------------------------"
#echo "Verifying the proof on-chain..."
#echo "--------------------------------"
#npx hardhat run scripts/verifyProof.js --network sepolia

echo "-----------------"
echo "- Step 8...Done -"
echo "-----------------"
