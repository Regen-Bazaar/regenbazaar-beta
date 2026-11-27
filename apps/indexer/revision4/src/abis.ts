// Event ABIs of contract revision 4, generated from packages/contracts/abis (forge build + export-abis).
// Regenerate after a contract change: python3 one-liner in apps/indexer/revision4/README.md.

export const TRWIV4Abi = [
  {
    "type": "event",
    "name": "CollectionRegistered",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "creator",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "easUID",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "totalIV",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "maxEditions",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "uri",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CollectionTerms",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "partner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "validator",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "proofLevel",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "methodologyVersion",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "transferable",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "royaltyBps",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "resaleFeeBps",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "resalePartnerBps",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ContributionStatement",
    "inputs": [
      {
        "name": "statementId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "holder",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "impactValue",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "inNameOf",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ImpactMinted",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "easUID",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ImpactReinstated",
    "inputs": [
      {
        "name": "easUID",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "by",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ImpactWithdrawn",
    "inputs": [
      {
        "name": "easUID",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "by",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "reasonURI",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  }
] as const;

export const PrimarySaleV3Abi = [
  {
    "type": "event",
    "name": "Sold",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "payer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "recipient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "currency",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "payout",
        "type": "tuple",
        "indexed": false,
        "internalType": "struct RegenPrimarySaleV3.Payout",
        "components": [
          {
            "name": "total",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "creatorPaid",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "platformPaid",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "partnerPaid",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "beneficiary",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "partner",
            "type": "address",
            "internalType": "address"
          }
        ]
      }
    ],
    "anonymous": false
  }
] as const;

export const MarketplaceV2Abi = [
  {
    "type": "event",
    "name": "Cancelled",
    "inputs": [
      {
        "name": "listingId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "returnedAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Listed",
    "inputs": [
      {
        "name": "listingId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "seller",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "pricePerEdition",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "currency",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Purchased",
    "inputs": [
      {
        "name": "listingId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "buyer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "currency",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "total",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "sellerPaid",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "creatorPaid",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "platformPaid",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "partnerPaid",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  }
] as const;
