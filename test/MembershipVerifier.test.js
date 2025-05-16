/**
 * @title MembershipVerifier test script
 * @notice Verifies a proof by interacting with the deployed verifier contract.
 * @dev Calls the verifyProof method with the generated calldata.
 */

const { ethers, defaultAbiCoder, network } = require("hardhat");
const snarkjs = require("snarkjs");
const { expect } = require("chai");
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const fs = require("fs");

describe("Testing that the Verifier:", function() {

    async function deployVerifier() {

        // deploy the verifier
        const [deployer] = await ethers.getSigners();
        const Verifier = await ethers.getContractFactory("MembershipVerifier");
        const verifier = await Verifier.deploy();
        await verifier.waitForDeployment();

        // load the VALID proof.json and public.json files (created from the witness)
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

        // create a false public signal by adding 1 to both of the array elements
        const _publicSignalsFalse = _publicSignals.map( x => BigInt(x) + BigInt(1));

        // create a false proof signal by adding 1 to the first array element
        let _proofFalse = [..._proof];
        _proofFalse[0] = _proofFalse[0] + BigInt(1);

        return { verifier, _proof, _publicSignals, _proofFalse, _publicSignalsFalse };
    }

    it(`accepts a valid proof`, async function () {

        const {  verifier, _proof, _publicSignals  }  = await loadFixture(deployVerifier);
   
        // call the verifyProof method:
        const isValidProof = await verifier.verifyProof(
            _proof,
            _publicSignals
        );
        
        expect(isValidProof).to.equal(true);

    });

    it(`rejects a false proof with tampered public signals`, async function () {

        const { verifier, _proof, _publicSignalsFalse }  = await loadFixture(deployVerifier);

        // call the verifyProof method:
        const isValidProof = await verifier.verifyProof(
            _proof,
            _publicSignalsFalse
        );
        
        expect(isValidProof).to.equal(false);

    });

    it(`rejects a false proof with tampered proof signals`, async function () {

        const { verifier, _proofFalse, _publicSignals }  = await loadFixture(deployVerifier);

        // call the verifyProof method:
        const isValidProof = await verifier.verifyProof(
            _proofFalse,
            _publicSignals
        );
        
        expect(isValidProof).to.equal(false);

    });


})
