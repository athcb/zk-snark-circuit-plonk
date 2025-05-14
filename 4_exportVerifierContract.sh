#!/bin/bash

echo "Exporting the verifier contract for the PasswordHash circuit"
echo "------------------------------------------------------------"
snarkjs zkey export solidityverifier build/password-circuit/password_final.zkey \
                                     contracts/PasswordVerifier.sol

echo "Exporting the verifier contract for the MembershipProof circuit"
echo "---------------------------------------------------------------"
snarkjs zkey export solidityverifier build/membership-circuit/membership_final.zkey \
                                     contracts/MembershipVerifier.sol

echo "-----------------"
echo "- Step 4...Done -"
echo "-----------------"