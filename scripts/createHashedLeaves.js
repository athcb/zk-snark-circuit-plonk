/**
 * @title create hashed leaves
 * @notice Creates a file containing the hashes of the ethereum addresses belonging to the "members" list.
 * @dev Utilizes the Poseidon hash function. 
 * @dev The hashed leaves can then be used to create the corresponding Merkle tree.
 */

const circomlib = require("circomlibjs");
const { MerkleTree } = require("fixed-merkle-tree");
const fs = require("fs");

async function main() {

    // parse ethereum addresses from addresses.json
    const addrList = JSON.parse(fs.readFileSync("data/addresses.json"));

    // ethereum hexadecimal addresses with 0x prefix:
    const addrListRaw = addrList.members;
    console.log("Ethereum addresses in hex: ", addrListRaw);

    // convert the addresses into a format suitable for proof verification 
    // use lowercase addresses and convert them to BigInt (Poseidon expects BigInt inputs):
    const addrBigInt = addrListRaw.map( (x) => BigInt(x.toLowerCase()));
    console.log("Ethereum addresses in BigInt: ", addrBigInt);

    // hash addresses with the Poseidon hash function:
    // Poseidon's output is a special object from the finite field F
    // F.toObject() returns it as a BigInt
    // circuits expect field elements as inputs but BigInt should be used to store the data off-chain or pass them to another library
    const poseidon = await circomlib.buildPoseidon();
    const leaves = addrBigInt.map( addr => poseidon.F.toObject(poseidon([addr])));
    console.log("Poseidon hashed addresses: ", leaves);

    // store hashed leaves:
    fs.writeFileSync("data/hashedLeaves.json", JSON.stringify(leaves.map( leaf => leaf.toString() ), null, 2 ));

    leaves.forEach( (leaf, i) => {
        console.log("Leaf at index ", i, ":", leaf);
    })

}

main()
    .then( () => process.exit(0))
    .catch( (error) => {
        console.error(error);
        process.exit(1);
    })




    