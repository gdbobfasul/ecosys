// Version: 1.0056
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SimpleMultiSig
 * @notice Minimal 3-of-5 multi-sig wallet for controlling KCY1 token
 * @dev v1.0056 - KISS principle: Keep It Simple Stupid!
 */
contract SimpleMultiSig {
    
    // ========================================================================
    // STATE
    // ========================================================================
    
    address[5] public owners;
    uint256 public constant REQUIRED = 3;  // 3-of-5 signatures
    
    struct Transaction {
        address to;           // Target contract (KCY1)
        bytes data;           // Function call data
        bool executed;        // Executed?
        uint256 confirmations; // Count
    }
    
    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmations;
    uint256 public transactionCount;
    
    // ========================================================================
    // EVENTS
    // ========================================================================
    
    event TransactionSubmitted(uint256 indexed txId, address indexed submitter, address to, bytes data);
    event TransactionConfirmed(uint256 indexed txId, address indexed confirmer);
    event TransactionExecuted(uint256 indexed txId);
    
    // ========================================================================
    // MODIFIERS
    // ========================================================================
    
    modifier onlyOwner() {
        bool _isOwner = false;
        for (uint i = 0; i < 5; i++) {
            if (owners[i] == msg.sender) {
                _isOwner = true;
                break;
            }
        }
        require(_isOwner, "Not owner");
        _;
    }
    
    modifier txExists(uint256 txId) {
        require(txId < transactionCount, "TX not exist");
        _;
    }
    
    modifier notExecuted(uint256 txId) {
        require(!transactions[txId].executed, "Already executed");
        _;
    }
    
    modifier notConfirmed(uint256 txId) {
        require(!confirmations[txId][msg.sender], "Already confirmed");
        _;
    }
    
    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================
    
    constructor(
        address owner1,  // Trezor 1
        address owner2,  // Trezor 2
        address owner3,  // Tangem 1
        address owner4,  // Tangem 2
        address owner5   // MetaMask backup
    ) {
        require(owner1 != address(0), "Invalid owner1");
        require(owner2 != address(0), "Invalid owner2");
        require(owner3 != address(0), "Invalid owner3");
        require(owner4 != address(0), "Invalid owner4");
        require(owner5 != address(0), "Invalid owner5");
        
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;
        owners[3] = owner4;
        owners[4] = owner5;
    }
    
    // ========================================================================
    // MAIN FUNCTIONS
    // ========================================================================
    
    /**
     * @notice Submit a new transaction
     * @param to Target contract address (KCY1 token)
     * @param data Function call data (encoded)
     * @return txId Transaction ID
     */
    function submitTransaction(address to, bytes memory data) 
        public 
        onlyOwner 
        returns (uint256 txId) 
    {
        txId = transactionCount;
        
        transactions[txId] = Transaction({
            to: to,
            data: data,
            executed: false,
            confirmations: 0
        });
        
        transactionCount++;
        
        emit TransactionSubmitted(txId, msg.sender, to, data);
        
        // Auto-confirm by submitter
        confirmTransaction(txId);
    }
    
    /**
     * @notice Confirm a transaction
     * @param txId Transaction ID
     */
    function confirmTransaction(uint256 txId) 
        public 
        onlyOwner 
        txExists(txId) 
        notExecuted(txId) 
        notConfirmed(txId) 
    {
        confirmations[txId][msg.sender] = true;
        transactions[txId].confirmations++;
        
        emit TransactionConfirmed(txId, msg.sender);
        
        // Auto-execute if threshold reached
        if (transactions[txId].confirmations >= REQUIRED) {
            executeTransaction(txId);
        }
    }
    
    /**
     * @notice Execute a confirmed transaction
     * @param txId Transaction ID
     */
    function executeTransaction(uint256 txId) 
        public 
        txExists(txId) 
        notExecuted(txId) 
    {
        Transaction storage txn = transactions[txId];
        require(txn.confirmations >= REQUIRED, "Not enough confirmations");
        
        txn.executed = true;
        
        (bool success, ) = txn.to.call(txn.data);
        require(success, "Transaction failed");
        
        emit TransactionExecuted(txId);
    }
    
    // ========================================================================
    // VIEW FUNCTIONS
    // ========================================================================
    
    /**
     * @notice Check if address is owner
     */
    function isOwner(address account) public view returns (bool) {
        for (uint i = 0; i < 5; i++) {
            if (owners[i] == account) return true;
        }
        return false;
    }
    
    /**
     * @notice Get transaction details
     */
    function getTransaction(uint256 txId) 
        public 
        view 
        returns (
            address to,
            bytes memory data,
            bool executed,
            uint256 confirmationCount
        ) 
    {
        Transaction storage txn = transactions[txId];
        return (
            txn.to,
            txn.data,
            txn.executed,
            txn.confirmations
        );
    }
    
    /**
     * @notice Check if owner confirmed transaction
     */
    function hasConfirmed(uint256 txId, address owner) 
        public 
        view 
        returns (bool) 
    {
        return confirmations[txId][owner];
    }
    
    /**
     * @notice Get all owners
     */
    function getOwners() public view returns (address[5] memory) {
        return owners;
    }
    
    /**
     * @notice Get pending transactions (not executed yet)
     */
    function getPendingTransactions() 
        public 
        view 
        returns (uint256[] memory) 
    {
        uint256 pendingCount = 0;
        
        // Count pending
        for (uint i = 0; i < transactionCount; i++) {
            if (!transactions[i].executed) {
                pendingCount++;
            }
        }
        
        // Collect pending IDs
        uint256[] memory pending = new uint256[](pendingCount);
        uint256 index = 0;
        
        for (uint i = 0; i < transactionCount; i++) {
            if (!transactions[i].executed) {
                pending[index] = i;
                index++;
            }
        }
        
        return pending;
    }
}
