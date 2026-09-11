// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SovereignEscrow.sol";

contract MockERC20 is IERC20 {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "ERC20: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "ERC20: insufficient balance");
        if (allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= amount, "ERC20: insufficient allowance");
            allowance[from][msg.sender] -= amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

contract SovereignEscrowTest is Test {
    SovereignEscrow public escrow;
    MockERC20 public usdc;

    address public buyer = address(0x1111);
    address public worker = address(0x2222);
    address public recipient = address(0x3333);
    address public attacker = address(0x9999);

    bytes32 public taskId = keccak256("task-demo-001");
    bytes32 public intentHash = keccak256("intent-demo-001");
    uint256 public amount = 8_000_000; // 8 USDC (6 decimals)
    uint256 public duration = 3600; // 1 hour

    function setUp() public {
        escrow = new SovereignEscrow();
        usdc = new MockERC20();

        // Mint USDC to buyer and approve escrow contract
        usdc.mint(buyer, 100_000_000); // 100 USDC
        vm.prank(buyer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function test_CreateEscrow_Success() public {
        vm.prank(buyer);
        uint256 expiry = block.timestamp + duration;
        uint256 escrowId = escrow.createEscrow(
            taskId,
            intentHash,
            worker,
            recipient,
            address(usdc),
            amount,
            expiry
        );

        assertEq(escrowId, 0);
        assertEq(usdc.balanceOf(address(escrow)), amount);
        assertEq(usdc.balanceOf(buyer), 100_000_000 - amount);

        SovereignEscrow.Escrow memory e = escrow.getEscrow(escrowId);
        assertEq(e.taskId, taskId);
        assertEq(e.intentHash, intentHash);
        assertEq(e.buyer, buyer);
        assertEq(e.worker, worker);
        assertEq(e.recipient, recipient);
        assertEq(e.token, address(usdc));
        assertEq(e.amount, amount);
        assertEq(uint256(e.state), uint256(SovereignEscrow.EscrowState.Created));
    }

    function test_RevertWhen_ZeroAmount() public {
        vm.prank(buyer);
        vm.expectRevert(SovereignEscrow.InvalidAmount.selector);
        escrow.createEscrow(taskId, intentHash, worker, recipient, address(usdc), 0, block.timestamp + duration);
    }

    function test_RevertWhen_ZeroRecipient() public {
        vm.prank(buyer);
        vm.expectRevert(SovereignEscrow.InvalidRecipient.selector);
        escrow.createEscrow(taskId, intentHash, worker, address(0), address(usdc), amount, block.timestamp + duration);
    }

    function test_RevertWhen_ZeroIntentHash() public {
        vm.prank(buyer);
        vm.expectRevert(SovereignEscrow.InvalidIntentHash.selector);
        escrow.createEscrow(taskId, bytes32(0), worker, recipient, address(usdc), amount, block.timestamp + duration);
    }

    function test_RevertWhen_ExpiredExpiry() public {
        vm.prank(buyer);
        vm.expectRevert(SovereignEscrow.EscrowExpired.selector);
        escrow.createEscrow(taskId, intentHash, worker, recipient, address(usdc), amount, block.timestamp);
    }

    function test_RevertWhen_DuplicateIntentHash() public {
        vm.startPrank(buyer);
        escrow.createEscrow(taskId, intentHash, worker, recipient, address(usdc), amount, block.timestamp + duration);

        vm.expectRevert(SovereignEscrow.IntentHashAlreadyUsed.selector);
        escrow.createEscrow(taskId, intentHash, worker, recipient, address(usdc), amount, block.timestamp + duration);
        vm.stopPrank();
    }

    function test_Release_Success() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(taskId, intentHash, worker, recipient, address(usdc), amount, block.timestamp + duration);

        vm.prank(buyer);
        escrow.release(escrowId, intentHash, recipient, amount);

        assertEq(usdc.balanceOf(recipient), amount);
        assertEq(usdc.balanceOf(address(escrow)), 0);

        SovereignEscrow.Escrow memory e = escrow.getEscrow(escrowId);
        assertEq(uint256(e.state), uint256(SovereignEscrow.EscrowState.Released));
    }

    function test_RevertWhen_UnauthorizedRelease() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(taskId, intentHash, worker, recipient, address(usdc), amount, block.timestamp + duration);

        vm.prank(attacker);
        vm.expectRevert(SovereignEscrow.UnauthorizedCaller.selector);
        escrow.release(escrowId, intentHash, recipient, amount);
    }

    function test_RevertWhen_ReleaseIntentHashMismatch() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(taskId, intentHash, worker, recipient, address(usdc), amount, block.timestamp + duration);

        vm.prank(buyer);
        vm.expectRevert(SovereignEscrow.IntentHashMismatch.selector);
        escrow.release(escrowId, keccak256("tampered-hash"), recipient, amount);
    }

    function test_RevertWhen_ReleaseRecipientMismatch() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(taskId, intentHash, worker, recipient, address(usdc), amount, block.timestamp + duration);

        vm.prank(buyer);
        vm.expectRevert(SovereignEscrow.RecipientMismatch.selector);
        escrow.release(escrowId, intentHash, attacker, amount);
    }

    function test_RevertWhen_ReleaseAmountMismatch() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(taskId, intentHash, worker, recipient, address(usdc), amount, block.timestamp + duration);

        vm.prank(buyer);
        vm.expectRevert(SovereignEscrow.AmountMismatch.selector);
        escrow.release(escrowId, intentHash, recipient, amount + 1_000_000);
    }

    function test_RevertWhen_ReleaseAfterExpiry() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(taskId, intentHash, worker, recipient, address(usdc), amount, block.timestamp + duration);

        // Warp time past expiry
        vm.warp(block.timestamp + duration + 1);

        vm.prank(buyer);
        vm.expectRevert(SovereignEscrow.EscrowExpired.selector);
        escrow.release(escrowId, intentHash, recipient, amount);
    }

    function test_RevertWhen_DuplicateRelease() public {
        vm.startPrank(buyer);
        uint256 escrowId = escrow.createEscrow(taskId, intentHash, worker, recipient, address(usdc), amount, block.timestamp + duration);
        escrow.release(escrowId, intentHash, recipient, amount);

        vm.expectRevert(SovereignEscrow.InvalidEscrowState.selector);
        escrow.release(escrowId, intentHash, recipient, amount);
        vm.stopPrank();
    }

    function test_Refund_AfterExpiry() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(taskId, intentHash, worker, recipient, address(usdc), amount, block.timestamp + duration);

        vm.warp(block.timestamp + duration + 1);

        escrow.refund(escrowId);

        assertEq(usdc.balanceOf(buyer), 100_000_000);
        assertEq(usdc.balanceOf(address(escrow)), 0);

        SovereignEscrow.Escrow memory e = escrow.getEscrow(escrowId);
        assertEq(uint256(e.state), uint256(SovereignEscrow.EscrowState.Refunded));
    }

    function test_RevertWhen_RefundBeforeExpiry() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(taskId, intentHash, worker, recipient, address(usdc), amount, block.timestamp + duration);

        vm.expectRevert(SovereignEscrow.EscrowNotExpired.selector);
        escrow.refund(escrowId);
    }

    function test_Cancel_Success() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(taskId, intentHash, worker, recipient, address(usdc), amount, block.timestamp + duration);

        vm.prank(buyer);
        escrow.cancel(escrowId);

        assertEq(usdc.balanceOf(buyer), 100_000_000);
        SovereignEscrow.Escrow memory e = escrow.getEscrow(escrowId);
        assertEq(uint256(e.state), uint256(SovereignEscrow.EscrowState.Cancelled));
    }

    function test_RevertWhen_AttackerCancels() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(taskId, intentHash, worker, recipient, address(usdc), amount, block.timestamp + duration);

        vm.prank(attacker);
        vm.expectRevert(SovereignEscrow.UnauthorizedCaller.selector);
        escrow.cancel(escrowId);
    }

    // Fuzz Testing: arbitrary valid amounts and durations
    function testFuzz_CreateAndRelease(uint256 fuzzAmount, uint256 fuzzDuration) public {
        vm.assume(fuzzAmount > 0 && fuzzAmount <= 50_000_000);
        vm.assume(fuzzDuration >= 60 && fuzzDuration <= 86400 * 30);

        bytes32 fuzzTaskId = keccak256(abi.encode(fuzzAmount, fuzzDuration));
        bytes32 fuzzIntent = keccak256(abi.encode(fuzzTaskId, block.timestamp));

        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(
            fuzzTaskId,
            fuzzIntent,
            worker,
            recipient,
            address(usdc),
            fuzzAmount,
            block.timestamp + fuzzDuration
        );

        vm.prank(buyer);
        escrow.release(escrowId, fuzzIntent, recipient, fuzzAmount);

        assertEq(usdc.balanceOf(recipient), fuzzAmount);
    }
}
