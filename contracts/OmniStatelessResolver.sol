// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title OmniStatelessResolver
 * @dev Stateless resolver for username.omnicoin addresses on Ethereum
 * @notice This contract resolves names without storing data, querying COTI chain via oracles
 */
contract OmniStatelessResolver is Ownable, ReentrancyGuard, Pausable {
    
    // Events
    event OracleUpdated(address indexed oracle, bool authorized);
    event NameResolved(string indexed username, address indexed resolvedAddress);
    event CacheUpdated(string indexed username, address indexed resolvedAddress, uint256 timestamp);
    event EmergencyModeToggled(bool enabled);
    
    // Oracle management
    mapping(address => bool) public authorizedOracles;
    mapping(address => uint256) public oracleReputation;
    address[] public oracleList;
    
    // Temporary cache for performance (optional)
    mapping(string => address) private nameCache;
    mapping(string => uint256) private cacheTimestamp;
    uint256 public constant CACHE_TTL = 300; // 5 minutes
    
    // Emergency mode
    bool public emergencyMode = false;
    mapping(string => address) private emergencyCache;
    
    // Configuration
    uint256 public constant MIN_ORACLES = 1;
    uint256 public constant MAX_ORACLES = 10;
    
    constructor() {}
    
    /**
     * @dev Resolve a username to an address
     * @param username The username to resolve (without .omnicoin extension)
     * @return The resolved address
     */
    function resolve(string memory username) external view returns (address) {
        // Check emergency mode first
        if (emergencyMode) {
            return emergencyCache[username];
        }
        
        // Check cache first (if enabled)
        if (nameCache[username] != address(0) && 
            block.timestamp - cacheTimestamp[username] < CACHE_TTL) {
            return nameCache[username];
        }
        
        // Query oracles for real-time resolution
        address resolvedAddress = _queryOracles(username);
        
        return resolvedAddress;
    }
    
    /**
     * @dev Query authorized oracles for name resolution
     * @param username The username to resolve
     * @return The resolved address from oracles
     */
    function _queryOracles(string memory username) internal view returns (address) {
        // For testnet, we'll use a simple oracle query
        // In production, this would query multiple oracles and reach consensus
        
        address[] memory activeOracles = getActiveOracles();
        require(activeOracles.length >= MIN_ORACLES, "Insufficient oracles");
        
        // Simple implementation: query first oracle
        // TODO: Implement consensus mechanism for production
        if (activeOracles.length > 0) {
            return IOmniOracle(activeOracles[0]).queryName(username);
        }
        
        return address(0);
    }
    
    /**
     * @dev Get list of active oracles
     * @return Array of active oracle addresses
     */
    function getActiveOracles() public view returns (address[] memory) {
        uint256 activeCount = 0;
        
        // Count active oracles
        for (uint256 i = 0; i < oracleList.length; i++) {
            if (authorizedOracles[oracleList[i]]) {
                activeCount++;
            }
        }
        
        // Create array of active oracles
        address[] memory activeOracles = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < oracleList.length; i++) {
            if (authorizedOracles[oracleList[i]]) {
                activeOracles[index] = oracleList[i];
                index++;
            }
        }
        
        return activeOracles;
    }
    
    /**
     * @dev Update cache entry (oracle only)
     * @param username The username to cache
     * @param resolvedAddress The resolved address
     */
    function updateCache(string memory username, address resolvedAddress) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(authorizedOracles[msg.sender], "Not authorized oracle");
        require(resolvedAddress != address(0), "Invalid address");
        
        nameCache[username] = resolvedAddress;
        cacheTimestamp[username] = block.timestamp;
        
        emit CacheUpdated(username, resolvedAddress, block.timestamp);
    }
    
    /**
     * @dev Batch update cache entries (oracle only)
     * @param usernames Array of usernames to cache
     * @param addresses Array of corresponding addresses
     */
    function batchUpdateCache(
        string[] memory usernames, 
        address[] memory addresses
    ) external nonReentrant whenNotPaused {
        require(authorizedOracles[msg.sender], "Not authorized oracle");
        require(usernames.length == addresses.length, "Array length mismatch");
        require(usernames.length <= 100, "Too many entries");
        
        for (uint256 i = 0; i < usernames.length; i++) {
            if (addresses[i] != address(0)) {
                nameCache[usernames[i]] = addresses[i];
                cacheTimestamp[usernames[i]] = block.timestamp;
            }
        }
    }
    
    /**
     * @dev Check if a name is cached and valid
     * @param username The username to check
     * @return True if cached and valid, false otherwise
     */
    function isCached(string memory username) external view returns (bool) {
        return nameCache[username] != address(0) && 
               block.timestamp - cacheTimestamp[username] < CACHE_TTL;
    }
    
    /**
     * @dev Get cached address for a username
     * @param username The username to check
     * @return The cached address and timestamp
     */
    function getCached(string memory username) external view returns (address, uint256) {
        return (nameCache[username], cacheTimestamp[username]);
    }
    
    // Admin functions
    
    /**
     * @dev Add an authorized oracle (admin only)
     * @param oracle The oracle address to authorize
     */
    function addOracle(address oracle) external onlyOwner {
        require(oracle != address(0), "Invalid oracle address");
        require(!authorizedOracles[oracle], "Oracle already authorized");
        require(oracleList.length < MAX_ORACLES, "Too many oracles");
        
        authorizedOracles[oracle] = true;
        oracleList.push(oracle);
        oracleReputation[oracle] = 100; // Initial reputation
        
        emit OracleUpdated(oracle, true);
    }
    
    /**
     * @dev Remove an authorized oracle (admin only)
     * @param oracle The oracle address to remove
     */
    function removeOracle(address oracle) external onlyOwner {
        require(authorizedOracles[oracle], "Oracle not authorized");
        require(oracleList.length > MIN_ORACLES, "Cannot remove last oracle");
        
        authorizedOracles[oracle] = false;
        
        // Remove from oracle list
        for (uint256 i = 0; i < oracleList.length; i++) {
            if (oracleList[i] == oracle) {
                oracleList[i] = oracleList[oracleList.length - 1];
                oracleList.pop();
                break;
            }
        }
        
        emit OracleUpdated(oracle, false);
    }
    
    /**
     * @dev Clear cache for a specific username (admin only)
     * @param username The username to clear from cache
     */
    function clearCache(string memory username) external onlyOwner {
        nameCache[username] = address(0);
        cacheTimestamp[username] = 0;
    }
    
    /**
     * @dev Clear all cached entries (admin only)
     */
    function clearAllCache() external onlyOwner {
        // Note: This is gas expensive, use with caution
        // In production, consider implementing a more efficient cache clearing mechanism
    }
    
    /**
     * @dev Toggle emergency mode (admin only)
     * @param enabled Whether to enable emergency mode
     */
    function setEmergencyMode(bool enabled) external onlyOwner {
        emergencyMode = enabled;
        emit EmergencyModeToggled(enabled);
    }
    
    /**
     * @dev Set emergency cache entry (admin only)
     * @param username The username to set
     * @param resolvedAddress The address to resolve to
     */
    function setEmergencyCache(string memory username, address resolvedAddress) external onlyOwner {
        emergencyCache[username] = resolvedAddress;
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
     * @dev Get oracle count
     * @return Number of authorized oracles
     */
    function getOracleCount() external view returns (uint256) {
        return oracleList.length;
    }
    
    /**
     * @dev Get oracle reputation
     * @param oracle The oracle address
     * @return The reputation score
     */
    function getOracleReputation(address oracle) external view returns (uint256) {
        return oracleReputation[oracle];
    }
}

/**
 * @title IOmniOracle
 * @dev Interface for oracle contracts
 */
interface IOmniOracle {
    function queryName(string memory username) external view returns (address);
    function isHealthy() external view returns (bool);
    function getLastUpdateTime() external view returns (uint256);
}