const circomlib = require("circomlibjs");
const fs = require("fs");
const { IncrementalMerkleTree } = require("@zk-kit/incremental-merkle-tree");


async function main() {

    // read the json file with the poseidon hashed leaves
    let hashedLeaves = JSON.parse(fs.readFileSync("data/hashedLeaves.json"));

    // cast to BigInt
    hashedLeaves = hashedLeaves.map( leaf => BigInt(leaf));
    //console.log(hashedLeaves);
    
    // define tree settings
    const treeDepth = 5;
    const zeroElement = 0n;
    const arity = 2;

    // Build the poseidon hash function 
    const poseidon = await circomlib.buildPoseidon();
    // Field from poseidon
    const F = poseidon.F; 
    const hashFn = (inputs) => {
        return poseidon.F.toObject(poseidon(inputs));
    };
    
    // create an empty incremental Merkle tree 
    const tree = new IncrementalMerkleTree(hashFn, treeDepth, BigInt(zeroElement), arity);

    // insert the leaves into the initialized tree
    for (const leaf of hashedLeaves) {
        tree.insert(leaf);
    }
    
    // get the proof for a the leaf at index 0
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

    console.log("Circuit inputs: ", circuitInputs);

    // save the inputs to file
    const filePath = "inputs/membership_input_LIMT.json";
    fs.writeFileSync(filePath, JSON.stringify(circuitInputs, null, 2));

    // create a FALSE proof for testing purposes
    // create the object with the same inputs for the circuit BUT with an altered leaf value
    // add 1 to the original leafValue (the circuit should compute a non-matching root if it starts with an different leaf value)
    const leafValueFalse = hashedLeaves[index] + BigInt(1);

    const circuitInputsFalse = {
        root: tree.root.toString(),
        leaf: leafValueFalse.toString(), 
        pathElements: proof.siblings.map( x => x[0].toString()),
        pathIndices: proof.pathIndices
    };

    // save the inputs to file
    const filePathFalse = "inputs/membership_input_FALSEPROOF.json";
    fs.writeFileSync(filePathFalse, JSON.stringify(circuitInputsFalse, null, 2));

    console.log("FALSE Circuit inputs: ", circuitInputsFalse);

}

main()
    .then( () => process.exit(0))
    .catch( (error) => {
        console.error(error);
        process.exit(1);
    })
