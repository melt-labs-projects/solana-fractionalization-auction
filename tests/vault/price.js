const anchor = require('@project-serum/anchor');

const priceProgram = (provider) => {
    const programID = new anchor.web3.PublicKey(priceTrackerIDL.metadata.address);
    return new anchor.Program(priceTrackerIDL, programID, provider);
}

const priceTrackerIDL = {
    "version": "0.0.0",
    "name": "price_tracker",
    "instructions": [
      {
        "name": "initialize",
        "accounts": [
          {
            "name": "priceAccount",
            "isMut": true,
            "isSigner": true
          },
          {
            "name": "store",
            "isMut": true,
            "isSigner": true
          },
          {
            "name": "storeAuthorityPda",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "storeMint",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "redeemMint",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "lockedMint",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "signer",
            "isMut": true,
            "isSigner": true
          },
          {
            "name": "tokenProgram",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "rent",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "pdaBump",
            "type": "u8"
          },
          {
            "name": "minPrice",
            "type": "u64"
          }
        ]
      },
      {
        "name": "initUserInfo",
        "accounts": [
          {
            "name": "priceAccount",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "userPda",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "storeMint",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "signer",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "rent",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "userBump",
            "type": "u8"
          }
        ]
      },
      {
        "name": "setMinPrice",
        "accounts": [
          {
            "name": "priceAccount",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "storeAuthorityPda",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "authority",
            "isMut": true,
            "isSigner": true
          }
        ],
        "args": [
          {
            "name": "pdaBump",
            "type": "u8"
          },
          {
            "name": "minPrice",
            "type": "u64"
          }
        ]
      },
      {
        "name": "addVote",
        "accounts": [
          {
            "name": "priceAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "store",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "userTokenAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "userPda",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "storeAuthorityPda",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "storeMint",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "signer",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "tokenProgram",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "rent",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "pdaBump",
            "type": "u8"
          },
          {
            "name": "userBump",
            "type": "u8"
          },
          {
            "name": "votes",
            "type": "u64"
          },
          {
            "name": "price",
            "type": "u64"
          }
        ]
      },
      {
        "name": "removeVote",
        "accounts": [
          {
            "name": "priceAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "store",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "userTokenAccount",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "userPda",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "storeAuthorityPda",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "storeMint",
            "isMut": false,
            "isSigner": false
          },
          {
            "name": "signer",
            "isMut": false,
            "isSigner": true
          },
          {
            "name": "tokenProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "pdaBump",
            "type": "u8"
          },
          {
            "name": "userBump",
            "type": "u8"
          },
          {
            "name": "votes",
            "type": "u64"
          }
        ]
      }
    ],
    "accounts": [
      {
        "name": "TokenInfo",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "reserveTotal",
              "type": "u64"
            },
            {
              "name": "totalVotes",
              "type": "u64"
            },
            {
              "name": "minPrice",
              "type": "u64"
            },
            {
              "name": "mint",
              "type": "publicKey"
            },
            {
              "name": "store",
              "type": "publicKey"
            },
            {
              "name": "lockedMint",
              "type": "publicKey"
            },
            {
              "name": "authority",
              "type": "publicKey"
            }
          ]
        }
      },
      {
        "name": "UserInfo",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "price",
              "type": "u64"
            },
            {
              "name": "votes",
              "type": "u64"
            }
          ]
        }
      },
      {
        "name": "ExternalPriceAccount",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "key",
              "type": "u8"
            },
            {
              "name": "pricePerShare",
              "type": "u64"
            },
            {
              "name": "priceMint",
              "type": "publicKey"
            },
            {
              "name": "allowedToCombine",
              "type": "bool"
            }
          ]
        }
      }
    ],
    "errors": [
      {
        "code": 300,
        "name": "NotEnoughTokensInAccount",
        "msg": "User doesn't have enough tokens in their account"
      },
      {
        "code": 301,
        "name": "NotEnoughVotesToRemove",
        "msg": "User is trying to remove more votes than they have"
      },
      {
        "code": 302,
        "name": "NumericalOverflowError",
        "msg": "Numerical Overflow Error"
      },
      {
        "code": 303,
        "name": "PriceTooHigh",
        "msg": "The price must be less than 5x the current weighted average"
      },
      {
        "code": 304,
        "name": "PriceTooLow1",
        "msg": "The price must be greater than the minimum set price"
      },
      {
        "code": 305,
        "name": "PriceTooLow2",
        "msg": "The price must be greater than 1/5th the current weighted average"
      }
    ],
    "metadata": {
      "address": "D8K3mcxvwDE7ykDPhL6xGXfkWXhbB1YS2nH3MCS1WmsD"
    }
  }

  module.exports = { priceProgram }