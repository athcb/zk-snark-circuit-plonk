/**
 * @title MembershipProof Verification Script 
 * @notice Verifies a zk-SNARK proof by calling a deployed MembershipVerifier contract on Sepolia.
 * @dev Loads the proof and public signal json files, formats the data according to the Plonk verifier contract,
 *      and calls the verifyProof method with the generated calldata.
 */

const { ethers } = require("hardhat");
const snarkjs = require("snarkjs");
const fs = require("fs");

async function main() {

    // address of deployed verifier contract
    const verifierAddress = process.env.MEMBERSHIP_VERIFIER_ADDRESS_SEPOLIA;
    
    const verifier = await ethers.getContractAt("MembershipVerifier", verifierAddress);

    // load the proof.json and public.json files (created from the witness)
    const proof = JSON.parse(fs.readFileSync("build/membership-circuit/proof.json"));
    const publicSignals = JSON.parse(fs.readFileSync("build/membership-circuit/public.json"));

    // export the calldata using the PLONK protocol:
    // output is in the format [proofString][publicSignalsArray]
    const rawCalldata = await snarkjs.plonk.exportSolidityCallData(proof, publicSignals);

    // parse the raw calldata to match the format expected by the verifyProof method
    // Verifier method: verifyProof(uint256[24] calldata _proof, uint256[2] calldata _pubSignals)
    // add a comma between the two [][] strings so that we can parse the proof and public signals arrays
    const calldata = `[${rawCalldata}]`.replace("][", "],[");

    let [_proof, _publicSignals] = JSON.parse(calldata);

    // convert _proof and _publicSignals to BigInts to match the expected method parameter input types
    _proof = _proof.map( x => BigInt(x));
    _publicSignals = _publicSignals.map( x => BigInt(x));

    //console.log("_proof: ", _proof);
    //console.log("_publicSignals: ", _publicSignals);

    // call the verifyProof method:
    const isValidProof = await verifier.verifyProof(
        _proof,
        _publicSignals
    );

    if(isValidProof) {
        console.log("Proof accepted!")
    } else {
        console.log("Proof rejected!")
    }
  
}

main()
    .then( () => process.exit(0))
    .catch( (error) => {
        console.error(error);
        process.exit(1);
    })