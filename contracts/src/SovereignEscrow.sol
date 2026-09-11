// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SovereignEscrow
 * @notice Escrow contract for Sovereign agent commerce settlements.
 * @dev Binds taskId, intentHash, buyer, worker, recipient, token, amount, expiry.
 *      Rejects incorrect recipient, amount, token, intent hash, unauthorized caller,
 *      expired settlement, duplicate release, and invalid escrow state.
 */
contract SovereignEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

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

    uint256 public nextEscrowId;
    mapping(uint256 => Escrow) public escrows;
    mapping(bytes32 => bool) public intentHashUsed;

    // ─── Events ────────────────────────────────────────────
    event EscrowCreated(uint256 indexed escrowId, bytes32 indexed taskId, bytes32 intentHash, address buyer, address worker, uint256 amount);
    event EscrowReleased(uint256 indexed escrowId, bytes32 indexed taskId, address recipient, uint256 amount);
    event EscrowRefunded(uint256 indexed escrowId, bytes32 indexed taskId, address buyer, uint256 amount);
    event EscrowCancelled(uint256 indexed escrowId, bytes32 indexed taskId);

    // ─── Errors ────────────────────────────────────────────
    error InvalidAmount();
    error InvalidRecipient();
    error InvalidIntentHash();
    error IntentHashAlreadyUsed();
    error EscrowNotFound();
    error InvalidEscrowState();
    error UnauthorizedCaller();
    error EscrowExpired();
    error EscrowNotExpired();
    error RecipientMismatch();
    error AmountMismatch();
    error TokenMismatch();
    error IntentHashMismatch();

    /**
     * @notice Create a new escrow. Buyer must approve token transfer first.
     */
    function createEscrow(
        bytes32 _taskId,
        bytes32 _intentHash,
        address _worker,
        address _recipient,
        address _token,
        uint256 _amount,
        uint256 _expiry
    ) external nonReentrant returns (uint256 escrowId) {
        if (_amount == 0) revert InvalidAmount();
        if (_recipient == address(0)) revert InvalidRecipient();
        if (_intentHash == bytes32(0)) revert InvalidIntentHash();
        if (intentHashUsed[_intentHash]) revert IntentHashAlreadyUsed();
        if (_expiry <= block.timestamp) revert EscrowExpired();

        escrowId = nextEscrowId++;

        escrows[escrowId] = Escrow({
            taskId: _taskId,
            intentHash: _intentHash,
            buyer: msg.sender,
            worker: _worker,
            recipient: _recipient,
            token: _token,
            amount: _amount,
            expiry: _expiry,
            state: EscrowState.Created
        });

        intentHashUsed[_intentHash] = true;

        // Transfer tokens from buyer to this contract
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        emit EscrowCreated(escrowId, _taskId, _intentHash, msg.sender, _worker, _amount);
    }

    /**
     * @notice Release escrowed funds to the recipient.
     * @dev Only buyer can release. Intent hash must match. Must not be expired.
     */
    function release(
        uint256 _escrowId,
        bytes32 _intentHash,
        address _recipient,
        uint256 _amount
    ) external nonReentrant {
        Escrow storage e = escrows[_escrowId];
        if (e.state == EscrowState.None) revert EscrowNotFound();
        if (e.state != EscrowState.Created) revert InvalidEscrowState();
        if (msg.sender != e.buyer) revert UnauthorizedCaller();
        if (block.timestamp > e.expiry) revert EscrowExpired();
        if (_intentHash != e.intentHash) revert IntentHashMismatch();
        if (_recipient != e.recipient) revert RecipientMismatch();
        if (_amount != e.amount) revert AmountMismatch();

        e.state = EscrowState.Released;

        IERC20(e.token).safeTransfer(e.recipient, e.amount);

        emit EscrowReleased(_escrowId, e.taskId, e.recipient, e.amount);
    }

    /**
     * @notice Refund escrowed funds to buyer after expiry.
     */
    function refund(uint256 _escrowId) external nonReentrant {
        Escrow storage e = escrows[_escrowId];
        if (e.state == EscrowState.None) revert EscrowNotFound();
        if (e.state != EscrowState.Created) revert InvalidEscrowState();
        if (block.timestamp <= e.expiry) revert EscrowNotExpired();

        e.state = EscrowState.Refunded;

        IERC20(e.token).safeTransfer(e.buyer, e.amount);

        emit EscrowRefunded(_escrowId, e.taskId, e.buyer, e.amount);
    }

    /**
     * @notice Cancel escrow. Only buyer can cancel before release.
     */
    function cancel(uint256 _escrowId) external nonReentrant {
        Escrow storage e = escrows[_escrowId];
        if (e.state == EscrowState.None) revert EscrowNotFound();
        if (e.state != EscrowState.Created) revert InvalidEscrowState();
        if (msg.sender != e.buyer) revert UnauthorizedCaller();

        e.state = EscrowState.Cancelled;

        IERC20(e.token).safeTransfer(e.buyer, e.amount);

        emit EscrowCancelled(_escrowId, e.taskId);
    }

    /**
     * @notice Get escrow details.
     */
    function getEscrow(uint256 _escrowId) external view returns (Escrow memory) {
        Escrow memory e = escrows[_escrowId];
        if (e.state == EscrowState.None) revert EscrowNotFound();
        return e;
    }
}
