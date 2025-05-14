#!/bin/bash

echo "Compiling the PasswordHash circuit..."
circom circuits/password.circom --r1cs --wasm --sym -o build/password-circuit

echo "Compiling the MembershipProof circuit..."
circom circuits/membership.circom --r1cs --wasm --sym -o build/membership-circuit

echo "-----------------"
echo "- Step 1...Done -"
echo "-----------------"