// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title OmniNameRegistry
 * @dev Registry for username.omnicoin addresses on COTI V2
 * @notice This contract manages username registrations for the OmniBazaar ecosystem
 */
contract OmniNameRegistry is Ownable, ReentrancyGuard, Pausable {
    
    // Events
    event NameRegistered(string indexed username, address indexed owner, uint256 timestamp);
    event NameTransferred(string indexed username, address indexed from, address indexed to);
    event NameUpdated(string indexed username, address indexed newAddress);
    event RegistrationFeeUpdated(uint256 newFee);
    event ReservedNameAdded(string indexed username);
    event ReservedNameRemoved(string indexed username);
    
    // Storage
    mapping(string => address) public names;              // username -> address
    mapping(address => string) public reverseNames;       // address -> primary username
    mapping(string => bool) public reservedNames;         // system reserved names
    mapping(string => uint256) public registrationTime;   // username -> timestamp
    
    // Configuration
    uint256 public registrationFee = 1 ether;             // 1 XOM in wei
    uint256 public constant MIN_USERNAME_LENGTH = 3;
    uint256 public constant MAX_USERNAME_LENGTH = 20;
    
    // Reserved names that cannot be registered
    string[] private defaultReservedNames = [
        "admin", "api", "www", "mail", "ftp", "root", "system", "omnibazaar", 
        "omnicoin", "wallet", "exchange", "support", "help", "info", "news"
    ];
    
    constructor() {
        // Add default reserved names
        for (uint i = 0; i < defaultReservedNames.length; i++) {
            reservedNames[defaultReservedNames[i]] = true;
        }
    }
    
    /**
     * @dev Register a username
     * @param username The username to register (without .omnicoin extension)
     */
    function register(string memory username) external payable nonReentrant whenNotPaused {
        require(msg.value >= registrationFee, "Insufficient registration fee");
        require(isValidUsername(username), "Invalid username format");
        require(names[username] == address(0), "Username already taken");
        require(!reservedNames[username], "Username is reserved");
        
        // Register the name
        names[username] = msg.sender;
        registrationTime[username] = block.timestamp;
        
        // Set as primary name if user doesn't have one
        if (bytes(reverseNames[msg.sender]).length == 0) {
            reverseNames[msg.sender] = username;
        }
        
        emit NameRegistered(username, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Register a name for another address (admin only)
     * @param username The username to register
     * @param owner The address to register it for
     */
    function registerFor(string memory username, address owner) external onlyOwner {
        require(isValidUsername(username), "Invalid username format");
        require(names[username] == address(0), "Username already taken");
        require(owner != address(0), "Invalid owner address");
        
        names[username] = owner;
        registrationTime[username] = block.timestamp;
        
        // Set as primary name if user doesn't have one
        if (bytes(reverseNames[owner]).length == 0) {
            reverseNames[owner] = username;
        }
        
        emit NameRegistered(username, owner, block.timestamp);
    }
    
    /**
     * @dev Transfer a name to another address
     * @param username The username to transfer
     * @param to The address to transfer to
     */
    function transfer(string memory username, address to) external nonReentrant {
        require(names[username] == msg.sender, "Not the owner");
        require(to != address(0), "Invalid recipient address");
        
        address from = msg.sender;
        names[username] = to;
        
        // Clear reverse name if this was the primary name
        if (keccak256(bytes(reverseNames[from])) == keccak256(bytes(username))) {
            reverseNames[from] = "";
        }
        
        // Set as primary name if recipient doesn't have one
        if (bytes(reverseNames[to]).length == 0) {
            reverseNames[to] = username;
        }
        
        emit NameTransferred(username, from, to);
    }
    
    /**
     * @dev Update the address for a username
     * @param username The username to update
     * @param newAddress The new address
     */
    function updateAddress(string memory username, address newAddress) external nonReentrant {
        require(names[username] == msg.sender, "Not the owner");
        require(newAddress != address(0), "Invalid address");
        
        names[username] = newAddress;
        
        emit NameUpdated(username, newAddress);
    }
    
    /**
     * @dev Set primary name for reverse resolution
     * @param username The username to set as primary
     */
    function setPrimaryName(string memory username) external {
        require(names[username] == msg.sender, "Not the owner");
        reverseNames[msg.sender] = username;
    }
    
    /**
     * @dev Resolve a username to an address
     * @param username The username to resolve
     * @return The associated address
     */
    function resolve(string memory username) external view returns (address) {
        return names[username];
    }
    
    /**
     * @dev Reverse resolve an address to its primary username
     * @param addr The address to resolve
     * @return The primary username
     */
    function reverseResolve(address addr) external view returns (string memory) {
        return reverseNames[addr];
    }
    
    /**
     * @dev Check if a username is available
     * @param username The username to check
     * @return True if available, false otherwise
     */
    function isAvailable(string memory username) external view returns (bool) {
        return names[username] == address(0) && 
               !reservedNames[username] && 
               isValidUsername(username);
    }
    
    /**
     * @dev Validate username format
     * @param username The username to validate
     * @return True if valid, false otherwise
     */
    function isValidUsername(string memory username) public pure returns (bool) {
        bytes memory usernameBytes = bytes(username);
        
        // Check length
        if (usernameBytes.length < MIN_USERNAME_LENGTH || usernameBytes.length > MAX_USERNAME_LENGTH) {
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
    
    /**
     * @dev Get registration timestamp for a username
     * @param username The username to check
     * @return The registration timestamp
     */
    function getRegistrationTime(string memory username) external view returns (uint256) {
        return registrationTime[username];
    }
    
    // Admin functions
    
    /**
     * @dev Update registration fee (admin only)
     * @param newFee The new registration fee
     */
    function setRegistrationFee(uint256 newFee) external onlyOwner {
        registrationFee = newFee;
        emit RegistrationFeeUpdated(newFee);
    }
    
    /**
     * @dev Add a reserved name (admin only)
     * @param username The username to reserve
     */
    function addReservedName(string memory username) external onlyOwner {
        reservedNames[username] = true;
        emit ReservedNameAdded(username);
    }
    
    /**
     * @dev Remove a reserved name (admin only)
     * @param username The username to unreserve
     */
    function removeReservedName(string memory username) external onlyOwner {
        reservedNames[username] = false;
        emit ReservedNameRemoved(username);
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
     * @dev Withdraw accumulated fees (admin only)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    /**
     * @dev Emergency function to update a name (admin only)
     * @param username The username to update
     * @param newOwner The new owner address
     */
    function emergencyUpdateName(string memory username, address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        
        address oldOwner = names[username];
        names[username] = newOwner;
        
        // Clear old reverse name if this was the primary
        if (keccak256(bytes(reverseNames[oldOwner])) == keccak256(bytes(username))) {
            reverseNames[oldOwner] = "";
        }
        
        // Set as primary for new owner if they don't have one
        if (bytes(reverseNames[newOwner]).length == 0) {
            reverseNames[newOwner] = username;
        }
        
        emit NameTransferred(username, oldOwner, newOwner);
    }
}