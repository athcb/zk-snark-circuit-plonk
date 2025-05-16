# zk-SNARK Proofs with the PLONK protocol

This project is meant to serve as a guide on how to generate and verify a zk-SNARK proof on- and off-chain using the **PLONK** protocol.

It includes all the steps in order to:
- create the **circom circuits**
- use the **PLONK** protocol and the **bn128 elliptic curve** for the **trusted setup** (Powers of Tau)
- generate the **proving and verification keys**
- generate the **witness** based on the given inputs
- generate the **proof** 
- **verify** the proof (on-chain and off-chain)

Versions: circom 2.2.2 (built from source https://github.com/iden3/circom.git), snarkjs 0.7.5


# PLONK vs Groth16

The advantage of PLONK over the Groth16 protocol is that the trusted setup can be reused across multiple circuits instead of it being circuit-specific like Groth16. 

This makes it very flexible for projects involving multiple circuits or circuits whose parameters may change over time.

## Circuit Logic Overview

### 1. Password hash proof

This circuit demonstrates a zero-knowledge proof of password knowledge using the Poseidon hash function from circomlib.

#### Purpose 
The PasswordHash circuit allows a prover to demonstrate knowledge of a secret password without revealing it. The only public values are:

- A Poseidon hash of the salted password

- The salt 

The verifier can confirm that the prover knows the password corresponding to the provided hash and salt, without learning anything about the password itself.

#### Inputs

- `publicHash` (public): The expected Poseidon hash of the password + salt.

- `salt` (public): A public salt value (can be made private if needed).

- `password` (private): The secret password known only to the prover.

#### Computation

The password is salted by computing:

```circom
salted <== password + salt;
```
The salted value is hashed using the Poseidon hash function:

```circom
computedHash <== Poseidon(1)([salted]);
```
#### Constraint

The circuit enforces that:

```circom
publicHash === computedHash;
```
This ensures that the prover must provide the correct password such that, when salted and hashed, it matches the known public hash.

### 2. Membership proof

The MembershipProof circuit allows a prover to demonstrate membership in a Merkle tree without revealing their identity or leaf value. This is achieved using a Merkle proof and the Poseidon hash function.

#### Purpose 
The circuit verifies that a hashed address is included in a known Merkle tree represented by a public Merkle root. It does this without revealing the leaf or any internal hashes.

#### Inputs
- `root` (public): The known Merkle root of the tree.

- `leaf` (private): The hashed value that we want to prove is part of the tree.

- `pathElements[treeLevels]` (private): Array of sibling nodes in the Merkle proof path.

- `pathIndices[treeLevels]` (private): Position indicators (0 = left, 1 = right) at each level of the tree.

The circuit uses the parameter `treeLevels` (set to 5 in the main component), which defines the depth of the Merkle tree. All Merkle proofs provided must be padded to match this depth.

#### Computation 

The circuit reconstructs the Merkle root by:

- Starting with currentHash[0] = leaf

- Iteratively hashing the current node with its sibling, left or right depending on `pathIndices`.

- At each layer i, a Poseidon hash of the left and right nodes is computed
- The order of concatenation is controlled by the `isLeft` and `isRight` signals derived from pathIndices.

#### Constraint

After traversing all treeLevels, the final hash is compared to the public root using the IsEqual comparator from circomlib.

The result is output as isMember:

- isMember = 1: Proof is valid (leaf is in the tree)

- isMember = 0: Invalid proof

A constraint is added in the circuit for isMember such that its value is enforced to be 1:

```circom
isMember === 1;
```
Without this constraint false proofs can be generated and the restriction isMember = 1 would have to be enforced elsewhere for false proof not to be accepted.

## 1. Create the circuits in circom

Formulate the input, output variables as well as the needed contraints for the two circuits.

To use the circomlib functions (in this case the Poseidon hash and the IsEqual component), add the library in the circuits/ repository:
```bash
git submodule add https://github.com/iden3/circomlib.git circomlib
```

### PasswordHash Circuit
*circuits/password.circom:*

```circom
pragma circom 2.2.2;


include "circomlib/circuits/poseidon.circom";


/**
 * @title PasswordHash
 * @notice Proves knowledge of a password such that the Poseidon hash of (password + salt) equals a publicly known hash.
 * @dev Uses circomlib's Poseidon hash function. The password remains private while the hash value and the salt are public.
 */
template PasswordHash {
    
    /**
     * @notice Public inputs: hash value of a salted password and its salt value.
     * @dev the salt value could also be stored privately. 
     */
    signal input publicHash;
    signal input salt;

    /**
     * @notice Private (secret) password the prover wants to prove knowledge of.
     * @dev Not revealed during the entire circuit.
     */
    signal input password;

    /**
     * @notice Intermediate value computed by the circuit.
     * @dev Internal value, not publicly exposed.
    */
    signal salted;
    salted <== password + salt;

    /**
     * @notice Computed Poseidon hash of the salted password.
     * @dev Constraint: has to match the public hash. 
    */
    signal computedHash;
    computedHash <== Poseidon(1)([salted]);
    publicHash === computedHash;
}

/**
 * @notice An instance of the PasswordHash circuit.
 * @dev Public signals should be declared below otherwise they will be treated as private.
*/
component main {public [publicHash, salt]} = PasswordHash();
```

### MembershipProof Circuit
*circuits/membership.circom:*

```circom
pragma circom 2.2.2;


include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";


/**
 * @title MembershipProof
 * @notice Verifies that an address belongs to a group represented by a Merkle tree, without revealing the address itself.
 * @dev Utilizes a Merkle proof to check that the computed Merkle root matches a known Merkle root. 
 * @dev Uses circomlib's Poseidon hash function for Merkle tree operations.
 */

/**
 * @notice Creates a tenplate that computes a Merkle proof for a tree with given treeLevels (layers).
 * @dev A tree with 16 leaves has log2(16) = 4 layers.
 */
template MembershipProof(treeLevels) {

    /**
     * @notice Declare the circuit's inputs. Root: public Merkle root.
     * @dev The computed root has to match this value.
     */
    signal input root;

    /**
     * @notice leaf: the hashed address we want to prove is a member of the Merkle tree.
     * @dev The address itself is a secret value.
     */
    signal input leaf;

    /**
     * @notice pathElements: the sibling nodes of the current hash at each tree level (layer).
     * @dev The current hash needs to be combined with the sibling node at each layer.
     * @dev A new hash value is then computed: Hash(current hash + pathElements hash) OR Hash(pathElements hash + current hash).
     */
    signal input pathElements[treeLevels];

    /**
     * @notice pathIndices: the position (left or right) of the current hash compared to the sibling node at each layer.
     * @dev 0 == left and 1 == right. 
     * @dev If left, then compute Hash(current hash + sibling hash). 
     * @dev If right, then compute Hash(sibling hash + current hash).
     */
    signal input pathIndices[treeLevels];

    /**
     * @notice isMember output signal: outputs a boolean indicating whether the address is part of the Merkle tree.
     * @dev isMember == 1 if the computed Merkle root matches the known Merkle root. 
     */
    signal output isMember;

    /**
     * @notice The component hashValues will be an instance of the Poseidon hash component at each tree layer.
     * @dev It is an array of the final hash value Hash(currentHash and sibling hash) at each layer of the tree path. 
     */
    component hashValues[treeLevels];

    /**
     * @notice Declares the internal signals left and right, which will hold the hashes of each child node at a given layer.
     * @dev The left and right signals define the order with which the hashes will be combined to obtain the final hash value of the layer.
     */
    signal left[treeLevels];
    signal right[treeLevels];

    /**
     * @notice Declares temporary signals used during the calculation of "left" and "right".
     * @dev The temporary variables are used as circom cannot handle multiple simultaneous operations.
     */
    signal left_a[treeLevels];
    signal left_b[treeLevels];
    signal right_a[treeLevels];
    signal right_b[treeLevels];

    /**
     * @notice Signals holding boolean values that indicate if the currentHash is on the left or right child node.
     * @dev Derived from the values in pathIndices[treeLevels].
     */
    signal isLeft[treeLevels];
    signal isRight[treeLevels];

    /**
     * @notice Sets the initial currentHash to the leaf node.
     * @dev The currentHash signal will hold the hash at each layer within our path.
     */
    signal currentHash[treeLevels+1];
    currentHash[0] <== leaf;

    for (var i = 0; i < treeLevels; i++) {

        /**
         * @notice Creates an instance of the Poseidon hash function that accepts two inputs.
         * @dev A new instance of the Poseidon component will be created for each path layer.
         */
        hashValues[i] = Poseidon(2);

        isLeft[i] <== 1 - pathIndices[i];
        isRight[i] <== pathIndices[i];
        
        /**
         * @notice Assigns the hash on the left node to "left".
         * @dev When isLeft = 1, left = currentHash[i]. When isLeft = 0, left = pathElements[i]. 
         */
        left_a[i] <== isLeft[i] * currentHash[i];
        left_b[i] <== isRight[i] * pathElements[i];
        left[i] <== left_a[i] + left_b[i];

        /**
         * @notice Assigns the hash on the right node to "right".
         * @dev When isLeft = 1, right = pathElements[i]. When isLeft = 0, right = currentHash[i]. 
         */
        right_a[i] <== isLeft[i] * pathElements[i];
        right_b[i] <== isRight[i] * currentHash[i];
        right[i] <== right_a[i] + right_b[i];
        
        /**
         * @notice Assigns the left and right hashes to the inputs of the Poseidon component instance.
         * @dev The Poseidon component was instantiated with 2 inputs (Poseidon(2)).
         */
        hashValues[i].inputs[0] <== left[i];
        hashValues[i].inputs[1] <== right[i];

        /**
         * @notice Assigns the result of Poseidon(left, right) to the currentHash.
         * @dev the out signal holds the result of the Poseidon hash with the given inputs.
         */
        currentHash[i + 1] <== hashValues[i].out;
        
    }

    /**
     * @notice Instantiates component from circomlib that evaluates equality of two variables.
     * @dev IsEqual accepts two inputs named "in" and stores the result in the output "out".
     */
    component checkEquality = IsEqual();
    checkEquality.in[0] <== currentHash[treeLevels];
    checkEquality.in[1] <== root;

    /**
     * @notice Assigns the result to the isMember output signal.
     * @dev returns true if the computed root hash matches the known Merkle root.
     */
    isMember <== checkEquality.out;

    /**
     * @notice Adds a contraint to the isMember flag.
     * @dev isMember has to be equal to 1 (i.e., the leaf has to be a valid member).
     * @dev without this constraint the circuit will only output 0 or 1 without enforcing either value.
     */
    isMember === 1;
}

/**
 * @notice Creates an instance of the MembershipProof template to prepare it for compilation.
 * @dev The tree levels have to be set to a fixed size. 
 * @dev The inputs pathElements and pathIndices have to be padded to that size even if the actual tree is shallower.
 * @dev Declares the root signal as public.
 */
component main {public [root]} = MembershipProof(5);
```

## 2. Compile the circuits
The compilation converts the circom file to low-level components needed to generate and verify proofs:
- --r1cs generates the Rank 1 Constraint System file: it defines all the arithmetic constraints that must be satisfied by the witness. It contains the wires, gates and aithmetic logic.
- --wasm generates the WebAssembly module that generates witnesses from input: this code will run to compute the internal signals given the input
- --sym generates a symbols file for debugging
- -o build: saves all outputs in the build folder


```bash
circom circuits/password.circom --r1cs --wasm --sym -o build/password-circuit

```

The compilation will produce a terminal output like the following: 
```bash
template instances: 71
non-linear constraints: 216
linear constraints: 200
public inputs: 2
private inputs: 1
public outputs: 0
wires: 419
labels: 586
```
To compile both circuits:

```bash
./1_compileCircuit.sh
```

## 3. Create Universal Trusted Setup 
The trusted setup prepares the cryptographic material needed to generate and verify zk-SNARK proofs using the PLONK protocol.


## Phase 1
### Generate a universal Structured Reference String (Powers of Tau)
The Powers of Tau is a public cerenomy independent of the specific circuit. 
- it specifies the elliptic curve used "bn128" 
- the maximum number of constraints 2**12
- creates an output file with the initial powers of tau
```bash
snarkjs powersoftau new bn128 12 trusted-setup/pot12_0000.ptau -v
```

In order to make the Powers of Tau trusted, multiple people can contribute randomness so that no one person controls the setup: 
- every time someone contributes entropy a new powers of tau file (.ptau) is created. 
- the final .ptau file is the trusted setup for the specific circuit.
```bash
snarkjs powersoftau contribute trusted-setup/pot12_0000.ptau trusted-setup/pot12_0001.ptau --name="First contribution" -v
```

For a second contribution of randomness:
```bash
snarkjs powersoftau contribute trusted-setup/pot12_0001.ptau trusted-setup/pot12_0002.ptau --name="Second contribution" -v
```

and so on.

## Phase 2 
In phase 2 of the Powers of Tau the final .ptau file is generated.
It takes the universal setup with the randomness contributions from phase 1 and changes is into a format suitable for PLONK. 

Unlike Groth16, Phase 2 of PLONK is remains **circuit-agnostic**. 

```bash
snarkjs powersoftau prepare phase2 trusted-setup/pot12_0002.ptau trusted-setup/pot12_final.ptau -v

```

To create the trusted setup:

```bash
./2_createTrustedSetup.sh
```

## 4. Generate zk-SNARK proving and verification keys

Generate the circuit-specific proving key and verification keys (zKey):
- specify which is the final .ptau file from phase 2 that should be used (output of trusted setup)
- apply the powers of tau file to the r1cs contraints of the compiled circuit

```bash
snarkjs plonk setup build/password-circuit/password.r1cs  trusted-setup/pot12_final.ptau build/password-circuit/password_final.zkey
```

Export the verification key:

```bash
snarkjs zkey export verificationkey build/password-circuit/password_final.zkey build/password-circuit/password_key.json
```

To generate the keys for both circuits:

```bash
./3_generateKeys.sh
```


# MembershipProof Circuit: Off-Chain Verification 

*This section will go through the steps in order to verify the **MembershipProof** circuit off-chain. The steps for the off- and on-chain verification of the PassowrdHash circuit can be found here: https://github.com/athcb/password-hash-zk-proof*

We need an input file that contains values for all private and public signals defined in the circom circuit (in the same order). This file will be used to generate the witness and provide a solution to our circuit (in case of a correct proof).

The signals that need to be part of the input.json file consist of the
- `root` (public): the publicly known merkle root
- `leaf` (secret): the leaf for which we are going to submit a proof
- `pathElements` (secret): the sibling nodes in the path of the Merkle tree
- `pathIndices` (secret): the indices showing whether we are on the left or right child node

### 1. Prepare a list of addresses

Create a list of (dummy) ethereum addresses that will make up the "members" group. These are the leaves of our tree.

*data/addresses.json:*

```javascript
{ 
    "members": [
        "0xbA4d2018154ac73bD7a0884822e2dF227A0FE6Ac",
        "0x0bd012c218b52A84705FCf923e1F183283bAa235",
        "0x0bd012c218b52A84705FCf923e1F183283bAa236"
    ]
}
```

### 2. Hash the leaves

The leaves need to be hashed before using them as an input to the Merkle Tree. We are working with the Poseidon hash, since it is highly optimized for ZK-Circuits. 

The addresses are parsed, formatted, hashed and saved to data/hashedLeaves.json.

*scripts/createHashedLeaves.js:*
```javascript
...

const poseidon = await circomlib.buildPoseidon();
const leaves = addrBigInt.map( addr => poseidon.F.toObject(poseidon([addr])));
console.log("Poseidon hashed addresses: ", leaves);

// store hashed leaves:
fs.writeFileSync("data/hashedLeaves.json", JSON.stringify(leaves.map( leaf => leaf.toString() ), null, 2 ));

...
```

### 3. Create the Merkle Tree

To construct the Merkle Tree based on the list of the members addresses, the following libraries were tested: 

- incremental-merkle-tree by zk-kit: https://www.npmjs.com/package/@zk-kit/incremental-merkle-tree, https://github.com/privacy-scaling-explorations/zk-kit
- fixed-merkle-tree by TornadoCash: https://github.com/tornadocash/fixed-merkle-tree

**Improtant considerations**
- the tree has to be padded to a "fixed" depth, the same one as defined in the circom circuit. 

If the circuit is compiled with a depth of 5 tree layers, it means that the tree will have 2**5 = 32 leaves. Given that our address list contains 3 entries, the rest of the leaves will have to be filled with default values (usually zeros) until all 32 slots are filled.

When using the zk-kit package: 
- the arity has to be defined: number of inputs for the Poseidon hash function
- the zeroElement (default value)

*scripts/createMerkleTree-LIMT:*

```javascript
...

const tree = new IncrementalMerkleTree(hashFn, treeDepth, BigInt(zeroElement), arity);

// insert the leaves into the initialized tree
for (const leaf of hashedLeaves) {
    tree.insert(leaf);
    }

...
```

After the Merkle Tree is created, we can get the Merkle proofs for given leafs.

*scripts/createMerkleTree-LIMT:*

```javascript
// get the proof for a given leaf
const index = 0;
const leafValue = hashedLeaves[index];
const proof = tree.createProof(index);

// create the object with the inputs for the circuit
const circuitInputs = {
    root: tree.root.toString(),
    leaf: leafValue.toString(), 
    pathElements: proof.siblings.map( x => x[0].toString()),
    pathIndices: proof.pathIndices
};

```
The circuitInputs will be the input values for our circuit and they are saved to inputs/membership_input.json.

To produce the input files for the leaf at index 0 using both Merkle Tree libraries run:

```bash
./5_generateCircuitInputs.sh
```
The Merkle proof we get from both libraries is identical:

```bash
Using Fixed-Merkle-Tree by TornadoCash:
---------------------------------------
Generating the merkle tree and dummy input values for circuit...
Circuit inputs:  {
  root: '11858598932349307318361014181872134183220323343349862538770939111541755948084',
  leaf: '18662699083581515132053402159012902122836088572548263913977277506910134734312',
  pathElements: [
    '14464865694242427692604124877944745271451478127051958408634579331968909957195',
    '19859404333981083031681342793811032781998967093519865202730802914189513774781',
    '7423237065226347324353380772367382631490014989348495481811164164159255474657',
    '11286972368698509976183087595462810875513684078608517520839298933882497716792',
    '3607627140608796879659380071776844901612302623152076817094415224584923813162'
  ],
  pathIndices: [ 0, 0, 0, 0, 0 ]
}
Using Incremental-Merkle-Tree by ZK-Kit:
---------------------------------------
Generating the merkle tree and dummy input values for circuit...
Circuit inputs:  {
  root: '11858598932349307318361014181872134183220323343349862538770939111541755948084',
  leaf: '18662699083581515132053402159012902122836088572548263913977277506910134734312',
  pathElements: [
    '14464865694242427692604124877944745271451478127051958408634579331968909957195',
    '19859404333981083031681342793811032781998967093519865202730802914189513774781',
    '7423237065226347324353380772367382631490014989348495481811164164159255474657',
    '11286972368698509976183087595462810875513684078608517520839298933882497716792',
    '3607627140608796879659380071776844901612302623152076817094415224584923813162'
  ],
  pathIndices: [ 0, 0, 0, 0, 0 ]
}
```
### 4. Generate the witness

Generate the witness with the wtns calculate command
- creates an output file .wtns which is then used to generate the proof
- the witness is a complete solution to the circuit. It includes all private, public and intermediate values  from internal wires in the circuit
- the witness has all the signal values that satisfy the constraints of the r1cs file

```bash
snarkjs wtns calculate build/membership-circuit/membership_js/membership.wasm \
                       inputs/membership_input.json \
                       build/membership-circuit/witness.wtns
```

Transform the .wtns file into a .json file to inspect its contents: 
```bash
snarkjs wtns export json build/membership-circuit/witness.wtns \
                         build/membership-circuit/witness.json
``` 
The witness.json file produces output starting with the following fields:

```javascript
 // placeholder value
"1",
// signal output value
"1",
 // tree root (public):
"11858598932349307318361014181872134183220323343349862538770939111541755948084",
// leaf (secret):
"18662699083581515132053402159012902122836088572548263913977277506910134734312",
// pathElements (5 in total):
"14464865694242427692604124877944745271451478127051958408634579331968909957195",
"19859404333981083031681342793811032781998967093519865202730802914189513774781",
"7423237065226347324353380772367382631490014989348495481811164164159255474657",
"11286972368698509976183087595462810875513684078608517520839298933882497716792",
"3607627140608796879659380071776844901612302623152076817094415224584923813162",
// pathIndices:
"0",
"0",
"0",
"0",
"0",

 ......
```

To generate the wtns and the witness.json file run:

```bash
./6_generateWitness.sh
```

Any attempt to generate a witness for a false proof will fail, throwing an error:

```bash
[ERROR] snarkJS: Error: Error: Assert Failed.
```

The assert refers to the constraint that isMember has to equal 1.

### 5. Generate the proof

Use the witness and the final .zkey to generate the proof without revealing the secret value:
- generates the proof.json file: stores the resulting proof
- generates the public.json file: stores the public inputs
- uses the **plonk prove** command to create a proof that satisfies the circuits constraints

```bash
snarkjs plonk prove build/membership-circuit/membership_final.zkey  \
                    build/membership-circuit/witness.wtns \
                    build/membership-circuit/proof.json \
                    build/membership-circuit/public.json
```

or run:

```bash
./7.generateProof.sh
```


### 6. Verify the proof

Verify the proof using the verification key, the public inputs and the proof.
- uses the **plonk verify** command
- outputs a console log message with the result of the verification (valid / invalid proof)

```bash
snarkjs plonk verify build/membership-circuit/verification_key.json \
                     build/membership-circuit/public.json \
                     build/membership-circuit/proof.json
```
If successfull: 

```bash
[INFO]  snarkJS: PLONK VERIFIER STARTED
[INFO]  snarkJS: OK!
```


# MembershipProof: On-Chain Proof Verification 

To verify the proof on-chain we need to:
1. Generate the Verifier.sol contract 
2. Deploy the Verifier contract
3. Generate the calldata 
4. Interact with the Verifier contract

Hardhat or Foundry can be used for the contract deployment. This project uses Hardhat. 

### 1. Generate the Verifier.sol contract

Use the final proving key (zKey) to generate the verifier contract with **zkey export**:
- after the verifier contract is deployed, its verifyProof(..) method can be called from other contracts
- all exported contracts will have the default name "PlonkVerifier". Rename the contract with the command above when running this command for multiple circuits.

```bash
snarkjs zkey export solidityverifier build/membership-circuit/membership_final.zkey \
                                     contracts/MembershipVerifier.sol

echo "Renaming the contract from PlonkVerifier to MembershipVerifier..."
sed -i 's/contract PlonkVerifier/contract MembershipVerifier/' contracts/MembershipVerifier.sol

```

or run:
```bash
./4_exportVerifierContract.sh
```

### 2. Deploy the Verifier contract

To compile and deploy the verifier contract (scripts/deployVerifier.js):

```javascript
...

const MembershipVerifier = await ethers.getContractFactory("MembershipVerifier");
const membershipVerifier = await MembershipVerifier.deploy();
await membershipVerifier.waitForDeployment();

console.log("MembershipVerifier contract deployed to address: ", membershipVerifier.target);

...
```

**MembershipVerifier contract address on Sepolia:**
`0x62Cc1dc5B553DF2FC73062f017c7C1eC4383e880`

### 3. Generate the calldata

To generate the calldata for the .verifyProof method in the Verifier contract:

```bash
snarkjs zkesc build/membership-circuit/public.json build/membership-circuit/proof.json
```
The calldata output has the following format: output is in the format: [proofString][publicSignalsArray]

or within a js script:

```javascript
const calldata = await snarkjs.plonk.exportSolidityCallData(proof, publicSignals);
```
where proof and publicSignals are the parsed data from proof.json and public.json.

### 4. Verify the proof


Verify the proof by calling the verifyProof method of the deployed membershipVerifier contract.

Reformat the calldata and call the verifyProof method (scripts/verifyMembershipProof):

```javascript
...
const isValidProof = await verifier.verifyProof(
    _proof,
    _publicSignals
);

if(isValidProof) {
    console.log("Proof accepted!")
} else {
    console.log("Proof rejected!")
}
...
```

# Complete zk-SNARK Workflow

The whole workflow including
1. Circuit compilation 
2. PLONK trusted setup
3. Proving and verification key generation
4. Solidity verifier contract export
5. Input values creation (dummy circuit inpus)
6. Witness generation
7. Proof generation
8. Proof verification (off-chain & on-chain)
can be run with the executable bash scripts 

-  runZkSnarkWorkflow_1to4.sh:
```bash
#!/bin/bash

./1_compileCircuit.sh

./2_createTrustedSetup.sh

./3_generateKeys.sh

./4_exportVerifierContract.sh
```
*Note: running the above more than once will produce different keys and different contracts that will have to be re-deployed and steps 5 to 8 will also have to be repeated!*

- runZkSnarkWorkflow_5to8.sh: 

```bash
#!/bin/bash

./5_generateCircuitInputs.sh

./6_generateWitness.sh

./7_generateProof.sh

./8_verifyProof.sh

```

To test new input values:
1. change the scripts/createMerkleTree.js script and the data/addresses.json with your chosen dummy values
2. execute runZkSnarkWorkflow_5to8.sh 

If the proof is accepted both on chain and off-chain the scripts will output:
```bash
--------------------------------
Verifying the proof off-chain...
--------------------------------
[INFO]  snarkJS: OK!
--------------------------------
Verifying the proof on-chain...
--------------------------------
Proof accepted!
```










