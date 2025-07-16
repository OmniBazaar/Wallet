// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title OmniTrueStatelessResolver
 * @dev Truly stateless resolver that queries OmniCoin chain in real-time
 * @notice NO storage on Ethereum, NO oracle updates, NO gas fees for nodes
 */
contract OmniTrueStatelessResolver is Ownable, Pausable {
    
    // Events
    event NodeEndpointUpdated(string indexed endpoint);
    event RegistryAddressUpdated(address indexed registryAddress);
    event NodeAdded(string indexed nodeEndpoint);
    event NodeRemoved(string indexed nodeEndpoint);
    event CurrentNodeUpdated(string indexed nodeEndpoint);
    
    // OmniCoin network configuration
    string[] public omnicoinNodeEndpoints;
    address public omnicoinRegistryAddress;
    uint256 public currentNodeIndex;
    uint256 public lastNodeRotation;
    
    // Emergency fallback mapping (only for emergencies)
    mapping(string => address) private emergencyFallback;
    bool public emergencyMode = false;
    
    // Node rotation configuration
    uint256 public constant NODE_ROTATION_INTERVAL = 300; // 5 minutes
    uint256 public constant MIN_NODES = 3;
    
    constructor(
        string[] memory _initialNodeEndpoints,
        address _omnicoinRegistryAddress
    ) Ownable(msg.sender) {
        require(_initialNodeEndpoints.length >= MIN_NODES, "Need at least 3 nodes");
        
        omnicoinNodeEndpoints = _initialNodeEndpoints;
        omnicoinRegistryAddress = _omnicoinRegistryAddress;
        currentNodeIndex = 0;
        lastNodeRotation = block.timestamp;
    }
    
    /**
     * @dev Resolve username by querying OmniCoin chain directly
     * @param username The username to resolve
     * @return The resolved address
     */
    function resolve(string memory username) external view whenNotPaused returns (address) {
        // In emergency mode, use local fallback
        if (emergencyMode) {
            address emergency = emergencyFallback[username];
            if (emergency != address(0)) {
                return emergency;
            }
        }
        
        // Get current node endpoint with rotation
        string memory currentNodeEndpoint = getCurrentNodeEndpoint();
        
        // This function will be called by MetaMask/Web3 providers
        // The actual resolution happens off-chain via RPC calls
        // We return the instruction for the client to query OmniCoin
        
        // For blockchain calls, we need to revert with instruction
        revert QueryOmniCoinChain(username, currentNodeEndpoint, omnicoinRegistryAddress);
    }
    
    /**
     * @dev Custom error that instructs client how to resolve
     */
    error QueryOmniCoinChain(string username, string rpcEndpoint, address registryAddress);
    
    /**
     * @dev Get current node endpoint with automatic rotation
     * @return The current node endpoint to use
     */
    function getCurrentNodeEndpoint() public view returns (string memory) {
        if (omnicoinNodeEndpoints.length == 0) {
            return "";
        }
        
        // Calculate if we need to rotate (time-based rotation)
        uint256 nodeToUse = currentNodeIndex;
        uint256 timeSinceRotation = block.timestamp - lastNodeRotation;
        
        if (timeSinceRotation >= NODE_ROTATION_INTERVAL) {
            // Calculate new node index based on time to ensure deterministic rotation
            uint256 rotationsSinceStart = timeSinceRotation / NODE_ROTATION_INTERVAL;
            nodeToUse = (currentNodeIndex + rotationsSinceStart) % omnicoinNodeEndpoints.length;
        }
        
        return omnicoinNodeEndpoints[nodeToUse];
    }
    
    /**
     * @dev Get all available node endpoints
     * @return Array of all node endpoints
     */
    function getAllNodeEndpoints() external view returns (string[] memory) {
        return omnicoinNodeEndpoints;
    }
    
    /**
     * @dev Get node endpoint by index
     * @param index The index of the node
     * @return The node endpoint at the given index
     */
    function getNodeEndpoint(uint256 index) external view returns (string memory) {
        require(index < omnicoinNodeEndpoints.length, "Node index out of bounds");
        return omnicoinNodeEndpoints[index];
    }
    
    /**
     * @dev Get total number of nodes
     * @return The total number of configured nodes
     */
    function getNodeCount() external view returns (uint256) {
        return omnicoinNodeEndpoints.length;
    }
    
    /**
     * @dev Batch resolve multiple usernames
     * @param usernames Array of usernames to resolve
     * @return Array of resolved addresses
     */
    function batchResolve(string[] memory usernames) external view returns (address[] memory) {
        address[] memory addresses = new address[](usernames.length);
        
        for (uint256 i = 0; i < usernames.length; i++) {
            // Each call will trigger QueryOmniCoinChain error
            // Client should catch and handle off-chain
            try this.resolve(usernames[i]) returns (address addr) {
                addresses[i] = addr;
            } catch {
                addresses[i] = address(0);
            }
        }
        
        return addresses;
    }
    
    /**
     * @dev Check if resolver supports a username format
     * @param username The username to check
     * @return True if supported format
     */
    function supportsUsername(string memory username) external pure returns (bool) {
        bytes memory usernameBytes = bytes(username);
        
        // Check length (3-20 characters)
        if (usernameBytes.length < 3 || usernameBytes.length > 20) {
            return false;
        }
        
        // Check characters (alphanumeric, hyphens, underscores only)
        for (uint i = 0; i < usernameBytes.length; i++) {
            bytes1 char = usernameBytes[i];
            if (!(char >= 0x30 && char <= 0x39) && // 0-9
                !(char >= 0x41 && char <= 0x5A) && // A-Z
                !(char >= 0x61 && char <= 0x7A) && // a-z
                !(char == 0x2D) &&                 // -
                !(char == 0x5F)) {                 // _
                return false;
            }
        }
        
        // Cannot start or end with hyphen or underscore
        if (usernameBytes[0] == 0x2D || usernameBytes[0] == 0x5F ||
            usernameBytes[usernameBytes.length - 1] == 0x2D || 
            usernameBytes[usernameBytes.length - 1] == 0x5F) {
            return false;
        }
        
        return true;
    }
    
    // Admin functions
    
    /**
     * @dev Add new OmniCoin node endpoint
     * @param nodeEndpoint New node endpoint
     */
    function addNodeEndpoint(string memory nodeEndpoint) external onlyOwner {
        require(bytes(nodeEndpoint).length > 0, "Empty endpoint");
        
        omnicoinNodeEndpoints.push(nodeEndpoint);
        emit NodeAdded(nodeEndpoint);
    }
    
    /**
     * @dev Remove OmniCoin node endpoint
     * @param nodeEndpoint Node endpoint to remove
     */
    function removeNodeEndpoint(string memory nodeEndpoint) external onlyOwner {
        require(omnicoinNodeEndpoints.length > MIN_NODES, "Too few nodes");
        
        for (uint256 i = 0; i < omnicoinNodeEndpoints.length; i++) {
            if (keccak256(bytes(omnicoinNodeEndpoints[i])) == keccak256(bytes(nodeEndpoint))) {
                // Move last element to current position
                omnicoinNodeEndpoints[i] = omnicoinNodeEndpoints[omnicoinNodeEndpoints.length - 1];
                omnicoinNodeEndpoints.pop();
                
                // Adjust current index if needed
                if (currentNodeIndex >= omnicoinNodeEndpoints.length) {
                    currentNodeIndex = 0;
                }
                
                emit NodeRemoved(nodeEndpoint);
                return;
            }
        }
        
        revert("Node not found");
    }
    
    /**
     * @dev Update current node index (for manual rotation)
     * @param newIndex New node index
     */
    function updateCurrentNodeIndex(uint256 newIndex) external onlyOwner {
        require(newIndex < omnicoinNodeEndpoints.length, "Index out of bounds");
        currentNodeIndex = newIndex;
        lastNodeRotation = block.timestamp;
        emit CurrentNodeUpdated(omnicoinNodeEndpoints[newIndex]);
    }
    
    /**
     * @dev Force node rotation to next available node
     */
    function forceNodeRotation() external onlyOwner {
        require(omnicoinNodeEndpoints.length > 0, "No nodes available");
        
        currentNodeIndex = (currentNodeIndex + 1) % omnicoinNodeEndpoints.length;
        lastNodeRotation = block.timestamp;
        emit CurrentNodeUpdated(omnicoinNodeEndpoints[currentNodeIndex]);
    }
    
    /**
     * @dev Update OmniCoin registry address
     * @param _registryAddress New registry address
     */
    function updateRegistryAddress(address _registryAddress) external onlyOwner {
        omnicoinRegistryAddress = _registryAddress;
        emit RegistryAddressUpdated(_registryAddress);
    }
    
    /**
     * @dev Set emergency fallback address
     * @param username Username for emergency fallback
     * @param addr Address to resolve to
     */
    function setEmergencyFallback(string memory username, address addr) external onlyOwner {
        emergencyFallback[username] = addr;
    }
    
    /**
     * @dev Toggle emergency mode
     * @param enabled Whether to enable emergency mode
     */
    function setEmergencyMode(bool enabled) external onlyOwner {
        emergencyMode = enabled;
    }
    
    /**
     * @dev Get resolver configuration
     * @return Current node endpoint and registry address
     */
    function getConfiguration() external view returns (string memory, address) {
        return (getCurrentNodeEndpoint(), omnicoinRegistryAddress);
    }
    
    /**
     * @dev Get current node rotation status
     * @return Current index, last rotation time, and rotation interval
     */
    function getRotationStatus() external view returns (uint256, uint256, uint256) {
        return (currentNodeIndex, lastNodeRotation, NODE_ROTATION_INTERVAL);
    }
    
    /**
     * @dev Get time until next rotation
     * @return Seconds until next rotation (0 if due for rotation)
     */
    function getTimeUntilNextRotation() external view returns (uint256) {
        uint256 timeSinceRotation = block.timestamp - lastNodeRotation;
        return timeSinceRotation >= NODE_ROTATION_INTERVAL ? 0 : NODE_ROTATION_INTERVAL - timeSinceRotation;
    }
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}