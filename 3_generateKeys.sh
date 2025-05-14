#!/bin/bash

echo "Generate keys for the PasswordHash circuit"
echo "------------------------------------------"
echo "Generating the zKey (proving and verification key) with PLONK..."
snarkjs plonk setup build/password-circuit/password.r1cs  \
                    trusted-setup/pot12_final.ptau \
                    build/password-circuit/password_final.zkey

echo "Generate keys for the MembershipProof circuit"
echo "---------------------------------------------"
echo "Generating the zKey (proving and verification key) with PLONK..."
snarkjs plonk setup build/membership-circuit/membership.r1cs  \
                    trusted-setup/pot12_final.ptau \
                    build/membership-circuit/membership_final.zkey

echo "-----------------"
echo "- Step 3...Done -"
echo "-----------------"