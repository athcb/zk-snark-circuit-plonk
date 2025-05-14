#!/bin/bash

echo "Phase 1 of universal trusted setup..."
echo "Creating the universal Structured Reference String..."
snarkjs powersoftau new bn128 12 trusted-setup/pot12_0000.ptau -v

echo "Adding randomness (entropy) contributions..."
echo "First contribution..."
snarkjs powersoftau contribute trusted-setup/pot12_0000.ptau trusted-setup/pot12_0001.ptau --name="First contribution" -v

echo "Second contribution..."
snarkjs powersoftau contribute trusted-setup/pot12_0001.ptau trusted-setup/pot12_0002.ptau --name="Second contribution" -v

echo "Phase 2 of universal trusted setup..."
echo "Transforming the universal setup to a format suitable for PLONK..."
snarkjs powersoftau prepare phase2 trusted-setup/pot12_0002.ptau trusted-setup/pot12_final.ptau 

echo "-----------------"
echo "- Step 2...Done -"
echo "-----------------"
