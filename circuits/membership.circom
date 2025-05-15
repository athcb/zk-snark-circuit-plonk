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
}

/**
 * @notice Creates an instance of the MembershipProof template to prepare it for compilation.
 * @dev The tree levels have to be set to a fixed size. 
 * @dev The inputs pathElements and pathIndices have to be padded to that size even if the actual tree is shallower.
 * @dev Declares the root signal as public.
 */
component main {public [root]} = MembershipProof(5);