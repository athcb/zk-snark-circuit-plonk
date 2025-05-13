pragma circom 2.2.2;


include "circomlib/circuits/poseidon.circom";


/**
 * @title MembershipProof
 * @notice Proves that a certain ethereum address is member of a group, without revealing the address itself.
 * @dev Uses circomlib's Poseidon hash function. 
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