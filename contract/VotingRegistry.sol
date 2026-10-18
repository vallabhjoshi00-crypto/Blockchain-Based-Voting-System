// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VotingRegistry
 * @dev Secure, tamper-proof biometric voting registry deployed on Ethereum.
 * Enforces single-vote validation per anonymized voter hash and records party tallies.
 */
contract VotingRegistry {
    address public admin;
    uint256 public totalVotes;

    // Mapping of anonymized voter SHA-256 hash to voted status (prevents double voting)
    mapping(string => bool) public hasVoted;

    // Mapping of party/candidate name to accumulated vote count
    mapping(string => uint256) public partyVotes;

    // Registry of active parties that have received votes
    string[] public partyList;
    mapping(string => bool) private partyRegistered;

    event VoteSecured(string voterHash, string party, uint256 timestamp);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only the authorized API relayer can submit verified votes");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /**
     * @notice Casts an immutable vote for a candidate party using an anonymized voter hash.
     * @param voterHash Cryptographic SHA-256 hash representing the verified voter ID.
     * @param party The name of the political party or candidate.
     */
    function castVote(string calldata voterHash, string calldata party) external onlyAdmin {
        require(bytes(voterHash).length > 0, "Voter hash cannot be empty");
        require(bytes(party).length > 0, "Party identifier cannot be empty");
        require(!hasVoted[voterHash], "Fraud Alert: This voter hash has already been used!");

        hasVoted[voterHash] = true;
        partyVotes[party] += 1;
        totalVotes += 1;

        if (!partyRegistered[party]) {
            partyRegistered[party] = true;
            partyList.push(party);
        }

        emit VoteSecured(voterHash, party, block.timestamp);
    }

    /**
     * @notice Returns the list of all parties that have received at least one vote.
     */
    function getPartyList() external view returns (string[] memory) {
        return partyList;
    }

    /**
     * @notice Transfers admin authority to a new address.
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "New admin cannot be zero address");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }
}