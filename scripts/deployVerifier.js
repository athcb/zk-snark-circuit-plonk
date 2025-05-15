/**
 * @title Verifier deployment
 * @notice Deploys the "MembershipVerifier" and "PasswordVerifier"
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
    Deployer's address:  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
    MembershipVerifier contract deployed to address:  0x5FbDB2315678afecb367f032d93F642f64180aa3
    PasswordVerifier contract deployed to address:  0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
    */
}

main()
    .then( () => process.exit(0))
    .catch( (error) => {
        console.error(error);
        process.exit(1);
    })