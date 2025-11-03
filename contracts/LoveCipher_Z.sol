pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract LoveCipherZ is ZamaEthereumConfig {
    struct EncryptedPreference {
        euint32 encryptedValue;
        address owner;
        uint256 timestamp;
        bool isMatched;
    }

    struct MatchResult {
        string user1;
        string user2;
        uint32 similarityScore;
        bool isUnlocked;
    }

    mapping(string => EncryptedPreference) public encryptedPreferences;
    mapping(string => MatchResult) public matchResults;
    string[] public userIds;

    event PreferenceRegistered(string indexed userId, address indexed owner);
    event MatchCalculated(string indexed user1, string indexed user2, uint32 similarityScore);
    event DataUnlocked(string indexed user1, string indexed user2);

    constructor() ZamaEthereumConfig() {
    }

    function registerEncryptedPreference(
        string calldata userId,
        externalEuint32 encryptedValue,
        bytes calldata inputProof
    ) external {
        require(encryptedPreferences[userId].owner == address(0), "User already registered");

        euint32 encrypted = FHE.fromExternal(encryptedValue, inputProof);
        require(FHE.isInitialized(encrypted), "Invalid encrypted input");

        encryptedPreferences[userId] = EncryptedPreference({
            encryptedValue: encrypted,
            owner: msg.sender,
            timestamp: block.timestamp,
            isMatched: false
        });

        FHE.allowThis(encryptedPreferences[userId].encryptedValue);
        FHE.makePubliclyDecryptable(encryptedPreferences[userId].encryptedValue);

        userIds.push(userId);
        emit PreferenceRegistered(userId, msg.sender);
    }

    function calculateMatch(
        string calldata user1,
        string calldata user2
    ) external {
        require(encryptedPreferences[user1].owner != address(0), "User1 not registered");
        require(encryptedPreferences[user2].owner != address(0), "User2 not registered");
        require(!matchResults[_getMatchKey(user1, user2)].isUnlocked, "Match already calculated");

        euint32 diff = FHE.sub(
            encryptedPreferences[user1].encryptedValue,
            encryptedPreferences[user2].encryptedValue
        );

        euint32 absDiff = FHE.abs(diff);
        euint32 similarity = FHE.sub(FHE.from(100), absDiff);

        uint32 similarityScore = FHE.decrypt(similarity);

        string memory matchKey = _getMatchKey(user1, user2);
        matchResults[matchKey] = MatchResult({
            user1: user1,
            user2: user2,
            similarityScore: similarityScore,
            isUnlocked: similarityScore > 75
        });

        encryptedPreferences[user1].isMatched = true;
        encryptedPreferences[user2].isMatched = true;

        emit MatchCalculated(user1, user2, similarityScore);
    }

    function unlockData(
        string calldata user1,
        string calldata user2
    ) external {
        string memory matchKey = _getMatchKey(user1, user2);
        require(matchResults[matchKey].similarityScore > 75, "Insufficient match score");
        require(!matchResults[matchKey].isUnlocked, "Data already unlocked");

        matchResults[matchKey].isUnlocked = true;
        emit DataUnlocked(user1, user2);
    }

    function getEncryptedPreference(string calldata userId) external view returns (euint32) {
        require(encryptedPreferences[userId].owner != address(0), "User not found");
        return encryptedPreferences[userId].encryptedValue;
    }

    function getMatchResult(string calldata user1, string calldata user2) external view returns (
        uint32 similarityScore,
        bool isUnlocked
    ) {
        string memory matchKey = _getMatchKey(user1, user2);
        require(matchResults[matchKey].similarityScore > 0, "Match not calculated");
        return (matchResults[matchKey].similarityScore, matchResults[matchKey].isUnlocked);
    }

    function getAllUserIds() external view returns (string[] memory) {
        return userIds;
    }

    function _getMatchKey(string memory user1, string memory user2) internal pure returns (string memory) {
        return keccak256(abi.encodePacked(user1, user2)) < keccak256(abi.encodePacked(user2, user1)) 
            ? string(abi.encodePacked(user1, user2)) 
            : string(abi.encodePacked(user2, user1));
    }
}


