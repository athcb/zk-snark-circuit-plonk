/**
 * @title Verifier Deployment Script
 * @notice Deploys the "MembershipVerifier" and "PasswordVerifier" contracts. 
 */

const { ethers } = require("hardhat");

async function main() {

    const [deployer] = await ethers.getSigners();
    console.log("Deployer's address: ", await deployer.getAddress());

    // deploy the membership verifier contract:
    const MembershipVerifier = await ethers.getContractFactory("MembershipVerifier");
    const membershipVerifier = await MembershipVerifier.deploy();
    await membershipVerifier.waitForDeployment();

    console.log("MembershipVerifier contract deployed to address: ", membershipVerifier.target);

    
    // deploy the membership verifier contract:
    const PasswordVerifier = await ethers.getContractFactory("PasswordVerifier");
    const passwordVerifier = await PasswordVerifier.deploy();
    await passwordVerifier.waitForDeployment();

    console.log("PasswordVerifier contract deployed to address: ", passwordVerifier.target);

    /* 
        Sepolia:
        MembershipVerifier contract deployed to address:  0xBAE04a255B5aa5A24f6a82a1dd5Bc308909b8ca5
        PasswordVerifier contract deployed to address:  0x395904D9D5Fa73F025a7FbAA1919e6Ff548f925D

    */
}

main()
    .then( () => process.exit(0))
    .catch( (error) => {
        console.error(error);
        process.exit(1);
    })