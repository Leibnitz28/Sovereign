// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISovereignEscrow {
    enum EscrowState { None, Created, Released, Refunded, Cancelled }

    struct Escrow {
        bytes32 taskId;
        bytes32 intentHash;
        address buyer;
        address worker;
        address recipient;
        address token;
        uint256 amount;
        uint256 expiry;
        EscrowState state;
    }

    event EscrowCreated(uint256 indexed escrowId, bytes32 indexed taskId, bytes32 intentHash, address buyer, address worker, uint256 amount);
    event EscrowReleased(uint256 indexed escrowId, bytes32 indexed taskId, address recipient, uint256 amount);
    event EscrowRefunded(uint256 indexed escrowId, bytes32 indexed taskId, address buyer, uint256 amount);
    event EscrowCancelled(uint256 indexed escrowId, bytes32 indexed taskId);

    function createEscrow(
        bytes32 _taskId,
        bytes32 _intentHash,
        address _worker,
        address _recipient,
        address _token,
        uint256 _amount,
        uint256 _expiry
    ) external returns (uint256 escrowId);

    function release(
        uint256 _escrowId,
        bytes32 _intentHash,
        address _recipient,
        uint256 _amount
    ) external;

    function refund(uint256 _escrowId) external;

    function cancel(uint256 _escrowId) external;

    function getEscrow(uint256 _escrowId) external view returns (Escrow memory);
}
