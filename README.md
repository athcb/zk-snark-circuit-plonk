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

- `siblings[treeLevels]` (private): Array of sibling nodes in the Merkle proof path.

- `hashPosition[treeLevels]` (private): Position indicators (0 = left, 1 = right) at each level of the tree.

The circuit uses the parameter `treeLevels` (set to 20 in the main component), which defines the depth of the Merkle tree. All Merkle proofs provided must be padded to match this depth.

#### Computation 

The circuit reconstructs the Merkle root by:

- Starting with currentHash[0] = leaf

- Iteratively hashing the current node with its sibling, left or right depending on `hashPosition`.

- At each layer i, a Poseidon hash of the left and right nodes is computed
- The order of concatenation is controlled by the `isLeft` and `isRight` signals derived from hashPosition.

#### Constraint

After traversing all treeLevels, the final hash is compared to the public root using the IsEqual comparator from circomlib.

The result is output as isMember:

- isMember = 1: Proof is valid (leaf is in the tree)

- isMember = 0: Invalid proof

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
     * @notice siblings: the sibling nodes of the current hash at each tree level (layer).
     * @dev The current hash needs to be combined with the sibling node at each layer.
     * @dev A new hash value is then computed: Hash(current hash + sibling hash) OR Hash(sibling hash + current hash).
     */
    signal input siblings[treeLevels];

    /**
     * @notice hashPosition: the position (left or right) of the current hash compared to the sibling node at each layer.
     * @dev 0 == left and 1 == right. 
     * @dev If left, then compute Hash(current hash + sibling hash). 
     * @dev If right, then compute Hash(sibling hash + current hash).
     */
    signal input hashPosition[treeLevels];

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
     * @dev Derived from the values in hashPosition[treeLevels].
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

        isLeft[i] <== 1 - hashPosition[i];
        isRight[i] <== hashPosition[i];
        
        /**
         * @notice Assigns the hash on the left node to "left".
         * @dev When isLeft = 1, left = currentHash[i]. When isLeft = 0, left = siblings[i]. 
         */
        left_a[i] <== isLeft[i] * currentHash[i];
        left_b[i] <== isRight[i] * siblings[i];
        left[i] <== left_a[i] + left_b[i];

        /**
         * @notice Assigns the hash on the right node to "right".
         * @dev When isLeft = 1, right = siblings[i]. When isLeft = 0, right = currentHash[i]. 
         */
        right_a[i] <== isLeft[i] * siblings[i];
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
}

/**
 * @notice Creates an instance of the MembershipProof template to prepare it for compilation.
 * @dev The tree levels have to be set to a fixed size. 
 * @dev The inputs siblings and hashPosition have to be padded to that size even if the actual tree is shallower.
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


