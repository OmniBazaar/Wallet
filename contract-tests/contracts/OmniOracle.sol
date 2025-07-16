// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title OmniOracle
 * @dev Oracle contract for bridging COTI chain name data to Ethereum
 * @notice This contract provides name resolution services for the stateless resolver
 */
contract OmniOracle is Ownable, ReentrancyGuard, Pausable {
    
    // Events
    event NameUpdated(string indexed username, address indexed newAddress, uint256 timestamp);
    event BatchUpdate(uint256 count, uint256 timestamp);
    event HealthCheckUpdated(bool healthy, uint256 timestamp);
    event ReputationUpdated(uint256 newReputation);
    
    // Storage
    mapping(string => address) private nameData;
    mapping(string => uint256) private lastUpdated;
    
    // Oracle metadata
    uint256 public lastUpdateTime;
    uint256 public reputation = 100;
    bool public healthy = true;
    
    // Configuration
    uint256 public constant MAX_BATCH_SIZE = 100;
    uint256 public constant UPDATE_COOLDOWN = 60; // 1 minute between updates
    
    // Authorized updaters (node operators)
    mapping(address => bool) public authorizedUpdaters;
    mapping(address => uint256) public updaterReputation;
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Query name resolution
     * @param username The username to resolve
     * @return The resolved address
     */
    function queryName(string memory username) external view returns (address) {
        return nameData[username];
    }
    
    /**
     * @dev Check if oracle is healthy
     * @return True if healthy, false otherwise
     */
    function isHealthy() external view returns (bool) {
        return healthy && block.timestamp - lastUpdateTime < 3600; // 1 hour
    }
    
    /**
     * @dev Get last update time
     * @return Timestamp of last update
     */
    function getLastUpdateTime() external view returns (uint256) {
        return lastUpdateTime;
    }
    
    /**
     * @dev Update a single name entry (authorized updater only)
     * @param username The username to update
     * @param resolvedAddress The resolved address
     */
    function updateName(string memory username, address resolvedAddress) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(authorizedUpdaters[msg.sender], "Not authorized updater");
        require(resolvedAddress != address(0), "Invalid address");
        require(
            block.timestamp - lastUpdated[username] >= UPDATE_COOLDOWN,
            "Update too frequent"
        );
        
        nameData[username] = resolvedAddress;
        lastUpdated[username] = block.timestamp;
        lastUpdateTime = block.timestamp;
        
        emit NameUpdated(username, resolvedAddress, block.timestamp);
    }
    
    /**
     * @dev Batch update name entries (authorized updater only)
     * @param usernames Array of usernames to update
     * @param addresses Array of corresponding addresses
     */
    function batchUpdateNames(
        string[] memory usernames, 
        address[] memory addresses
    ) external nonReentrant whenNotPaused {
        require(authorizedUpdaters[msg.sender], "Not authorized updater");
        require(usernames.length == addresses.length, "Array length mismatch");
        require(usernames.length <= MAX_BATCH_SIZE, "Batch too large");
        
        uint256 updateCount = 0;
        
        for (uint256 i = 0; i < usernames.length; i++) {
            if (addresses[i] != address(0) && 
                block.timestamp - lastUpdated[usernames[i]] >= UPDATE_COOLDOWN) {
                
                nameData[usernames[i]] = addresses[i];
                lastUpdated[usernames[i]] = block.timestamp;
                updateCount++;
                
                emit NameUpdated(usernames[i], addresses[i], block.timestamp);
            }
        }
        
        if (updateCount > 0) {
            lastUpdateTime = block.timestamp;
            emit BatchUpdate(updateCount, block.timestamp);
        }
    }
    
    /**
     * @dev Remove a name entry (authorized updater only)
     * @param username The username to remove
     */
    function removeName(string memory username) external nonReentrant whenNotPaused {
        require(authorizedUpdaters[msg.sender], "Not authorized updater");
        require(nameData[username] != address(0), "Name not found");
        
        delete nameData[username];
        delete lastUpdated[username];
        lastUpdateTime = block.timestamp;
        
        emit NameUpdated(username, address(0), block.timestamp);
    }
    
    /**
     * @dev Get name data with metadata
     * @param username The username to check
     * @return The resolved address and last update time
     */
    function getNameData(string memory username) external view returns (address, uint256) {
        return (nameData[username], lastUpdated[username]);
    }
    
    /**
     * @dev Check if name exists in oracle
     * @param username The username to check
     * @return True if name exists, false otherwise
     */
    function hasName(string memory username) external view returns (bool) {
        return nameData[username] != address(0);
    }
    
    /**
     * @dev Get oracle statistics
     * @return Last update time, reputation, and health status
     */
    function getOracleStats() external view returns (uint256, uint256, bool) {
        return (lastUpdateTime, reputation, healthy);
    }
    
    // Admin functions
    
    /**
     * @dev Add an authorized updater (admin only)
     * @param updater The address to authorize
     */
    function addUpdater(address updater) external onlyOwner {
        require(updater != address(0), "Invalid updater address");
        require(!authorizedUpdaters[updater], "Already authorized");
        
        authorizedUpdaters[updater] = true;
        updaterReputation[updater] = 100; // Initial reputation
    }
    
    /**
     * @dev Remove an authorized updater (admin only)
     * @param updater The address to remove
     */
    function removeUpdater(address updater) external onlyOwner {
        require(authorizedUpdaters[updater], "Not authorized");
        
        authorizedUpdaters[updater] = false;
        updaterReputation[updater] = 0;
    }
    
    /**
     * @dev Update updater reputation (admin only)
     * @param updater The updater address
     * @param newReputation The new reputation score
     */
    function updateUpdaterReputation(address updater, uint256 newReputation) external onlyOwner {
        require(authorizedUpdaters[updater], "Not authorized");
        updaterReputation[updater] = newReputation;
    }
    
    /**
     * @dev Set health status (admin only)
     * @param _healthy The new health status
     */
    function setHealthStatus(bool _healthy) external onlyOwner {
        healthy = _healthy;
        emit HealthCheckUpdated(_healthy, block.timestamp);
    }
    
    /**
     * @dev Update oracle reputation (admin only)
     * @param newReputation The new reputation score
     */
    function updateReputation(uint256 newReputation) external onlyOwner {
        reputation = newReputation;
        emit ReputationUpdated(newReputation);
    }
    
    /**
     * @dev Emergency name update (admin only)
     * @param username The username to update
     * @param resolvedAddress The new address
     */
    function emergencyUpdateName(string memory username, address resolvedAddress) external onlyOwner {
        nameData[username] = resolvedAddress;
        lastUpdated[username] = block.timestamp;
        lastUpdateTime = block.timestamp;
        
        emit NameUpdated(username, resolvedAddress, block.timestamp);
    }
    
    /**
     * @dev Pause contract (admin only)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract (admin only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Get updater reputation
     * @param updater The updater address
     * @return The reputation score
     */
    function getUpdaterReputation(address updater) external view returns (uint256) {
        return updaterReputation[updater];
    }
    
    /**
     * @dev Check if address is authorized updater
     * @param updater The address to check
     * @return True if authorized, false otherwise
     */
    function isAuthorizedUpdater(address updater) external view returns (bool) {
        return authorizedUpdaters[updater];
    }
}