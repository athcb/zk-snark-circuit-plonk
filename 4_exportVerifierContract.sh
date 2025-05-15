#!/bin/bash

echo "Exporting the verifier contract for the PasswordHash circuit"
echo "------------------------------------------------------------"
snarkjs zkey export solidityverifier build/password-circuit/password_final.zkey \
                                     contracts/PasswordVerifier.sol

echo "Renaming the contract from PlonkVerifier to PasswordVerifier..."
sed -i 's/contract PlonkVerifier/contract PasswordVerifier/' contracts/PasswordVerifier.sol


echo "Exporting the verifier contract for the MembershipProof circuit"
echo "---------------------------------------------------------------"
snarkjs zkey export solidityverifier build/membership-circuit/membership_final.zkey \
                                     contracts/MembershipVerifier.sol

echo "Renaming the contract from PlonkVerifier to MembershipVerifier..."
sed -i 's/contract PlonkVerifier/contract MembershipVerifier/' contracts/MembershipVerifier.sol


echo "-----------------"
echo "- Step 4...Done -"
echo "-----------------"