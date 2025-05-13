# zk-SNARK Proof Implementation Guide

The following is meant to serve as an example on how to generate and verify a zk-SNARK proof on- and off-chain using the **PLONK** protocol.

It includes all the needed steps in order to:
- create the circom circuit 
- use the PLONK protocol and the bn128 elliptic curve for the trusted setup (Powers of Tau)
- generate the proving and verification keys
- generate the witness based on the given inputs
- generate the proof 
- verify the proof (on chain and off chain)


Versions: circom 2.2.2 (built from source https://github.com/iden3/circom.git), snarkjs 0.7.5

# PLONK vs Groth16

The advantage of PLONK over the Groth16 protocol is that the trusted setup can be reused across multiple circuits instead of it being circuit-specific like Groth16. 

This makes it very flexible for projects involving multiple circuits or circuits whose parameters may change over time.

In this repository I test the usage of PLONK on two circuits:

### 1. Password hash proof

Goal: Prove knowledge of a password that results in a given (public) hash without revealing the password itself.

### 2. Membership proof

Goal: Prove that an address is member of a group, without revealing the address itself. 
