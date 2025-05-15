#!/bin/bash

echo "Generating the witness for the membership proof based on the input values..."
snarkjs wtns calculate build/membership-circuit/membership_js/membership.wasm \
                       inputs/membership_input.json \
                       build/membership-circuit/witness.wtns

echo "Exporting the witness .wtns file to .json..."
snarkjs wtns export json build/membership-circuit/witness.wtns \
                         build/membership-circuit/witness.json

echo "-----------------"
echo "- Step 6...Done -"
echo "-----------------"