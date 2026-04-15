// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title FTRToken v5.0
 * @notice Future Trade Rights Token - ERC721 with surrender and deregistration
 * @dev IPR Owner: Rohit Tidke | Intech Research Group
 */
contract FTRToken is ERC721, ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum TokenState { UNMINTED, AVAILABLE, LISTED, EARMARKED, REDEEMED, SURRENDERED, DEREGISTERED }

    struct Token {
        uint256 faceValue;
        string currency;
        TokenState state;
        address surrenderWallet;
        uint256 surrenderedAt;
        bool holderOptionExercised;
    }

    mapping(uint256 => Token) public tokens;
    mapping(address => bool) public surrenderWallets;
    
    uint256 public constant HOLDER_OPTION_DAYS = 7;
    uint256 public constant SURRENDER_RATIO = 55; // 55%

    event TokenMinted(uint256 indexed tokenId, address indexed holder, uint256 faceValue);
    event TokenSurrendered(uint256 indexed tokenId, address indexed surrenderWallet);
    event TokenDeregistered(uint256 indexed tokenId, address indexed holder);
    event SurrenderWalletCreated(address indexed wallet, address indexed minter);

    constructor() ERC721("FTR Token", "FTR") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function mint(address to, uint256 tokenId, uint256 faceValue, string memory uri) external onlyRole(MINTER_ROLE) {
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        tokens[tokenId] = Token({ faceValue: faceValue, currency: "INR", state: TokenState.AVAILABLE, surrenderWallet: address(0), surrenderedAt: 0, holderOptionExercised: false });
        emit TokenMinted(tokenId, to, faceValue);
    }

    function createSurrenderWallet(address wallet) external onlyRole(ADMIN_ROLE) {
        surrenderWallets[wallet] = true;
        emit SurrenderWalletCreated(wallet, msg.sender);
    }

    function surrender(uint256 tokenId, address wallet) external {
        require(ownerOf(tokenId) == msg.sender || hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        require(surrenderWallets[wallet], "Invalid surrender wallet");
        tokens[tokenId].state = TokenState.SURRENDERED;
        tokens[tokenId].surrenderWallet = wallet;
        tokens[tokenId].surrenderedAt = block.timestamp;
        _transfer(ownerOf(tokenId), wallet, tokenId);
        emit TokenSurrendered(tokenId, wallet);
    }

    function deregister(uint256 tokenId) external {
        Token storage token = tokens[tokenId];
        require(token.state == TokenState.SURRENDERED, "Not surrendered");
        require(block.timestamp <= token.surrenderedAt + (HOLDER_OPTION_DAYS * 1 days), "Option expired");
        require(!token.holderOptionExercised, "Already exercised");
        token.state = TokenState.DEREGISTERED;
        token.holderOptionExercised = true;
        _burn(tokenId);
        emit TokenDeregistered(tokenId, msg.sender);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) { return super.tokenURI(tokenId); }
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool) { return super.supportsInterface(interfaceId); }
}
