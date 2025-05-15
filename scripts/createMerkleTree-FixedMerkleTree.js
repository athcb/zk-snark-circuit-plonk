/**
 * @title Merkle Tree Generator 
 * @notice Uses the hashed leaves to create a Merkle Tree.
 * @dev Utilizes the Poseidon hash function. 
 * @dev The tree has a fixed depth. 
 * @dev The leaves are padded with zeros until all empty leaf positions are filled.
 */

const circomlib = require("circomlibjs");
const { MerkleTree } = require("fixed-merkle-tree");
const fs = require("fs");

async function main() {

    // read the json file with the poseidon hashed leaves
    let hashedLeaves = JSON.parse(fs.readFileSync("data/hashedLeaves.json"));

    // cast to BigInt
    hashedLeaves = hashedLeaves.map( leaf => BigInt(leaf));
    
    // define tree height
    const treeHeight = 5;

    // Build the poseidon hash function 
    const poseidon = await circomlib.buildPoseidon();
    const hashFn = (left, right) => {
        const inputs = [left, right];
        return poseidon.F.toObject(poseidon(inputs));
    };

    // build the Merkle tree 
    const tree = new MerkleTree(treeHeight, hashedLeaves, { hashFunction: hashFn });

    // get the proof for a given leaf
    leafValue = hashedLeaves[0];
    const proof = tree.proof(leafValue);
    
    // create the object with the inputs for the circuit
    const circuitInputs = {
        root: proof.pathRoot.toString(),
        leaf: leafValue.toString(), 
        pathElements: proof.pathElements.map( x => x.toString()),
        pathIndices: proof.pathIndices
    };

    console.log("Circuit inputs: ", circuitInputs);

    // save the inputs to file
    const filePath = "inputs/membership_input.json";
    fs.writeFileSync(filePath, JSON.stringify(circuitInputs, null, 2));

}

main()
    .then( () => process.exit(0))
    .catch( (error) => {
        console.error(error);
        process.exit(1);
    })




