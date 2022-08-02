const borsh = require('borsh');
const base58 = require('bs58');

const extendBorsh = () => {

    (borsh.BinaryReader.prototype).readPubkeyAsString = function () {
        const reader = this;
        const array = reader.readFixedArray(32);
        return base58.encode(array);
    };

    (borsh.BinaryWriter.prototype).writePubkeyAsString = function (value) {
        const writer = this;
        writer.writeFixedArray(base58.decode(value));
    };

};

const VAULT_ACCOUNT_SIZE = 205;
const PRICE_ACCOUNT_SIZE = 42;

class InstructionArg {
    constructor(instruction) {
        this.instruction = instruction;
    }
}

class InitVaultArgs {
    constructor(allowFurtherShareCreation) {
        this.instruction = 0;
        this.allowFurtherShareCreation = allowFurtherShareCreation;
    }
}

class AmountArgs {
    constructor(instruction, amount) {
        this.instruction = instruction;
        this.amount = amount;
    }
}

class NumberOfShareArgs {
    constructor(instruction, numberOfShares) {
        this.instruction = instruction;
        this.numberOfShares = numberOfShares;
    }
}

class ExternalPriceAccount {
    constructor(pricePerShare, priceMint, allowedToCombine) {
        this.discriminator = 0;
        this.key = 2;
        this.pricePerShare = pricePerShare;
        this.priceMint = priceMint;
        this.allowedToCombine = allowedToCombine;
    }
}

class UpdateExternalPriceAccountArgs {
    constructor(externalPriceAccount) {
        this.instruction = 9;
        this.externalPriceAccount = externalPriceAccount;
    }
}

class SafetyDepositBox {
    constructor(data) {this.data = data}
}

//const schema = new Map([[InitVaulArgs, { kind: 'struct', fields: [['instruction', 'u8'], ['allowFurtherShareCreation', 'u8']] }]]);
const VAULT_SCHEMA = new Map([
    [ InstructionArg, { kind: 'struct', fields: [ ['instruction', 'u8'], ], }, ],
    [ InitVaultArgs, { kind: 'struct', fields: [ ['instruction', 'u8'], ['allowFurtherShareCreation', 'u8'], ], }, ],
    [ AmountArgs, { kind: 'struct', fields: [ ['instruction', 'u8'], ['amount', 'u64'], ], }, ],
    [ NumberOfShareArgs, { kind: 'struct', fields: [ ['instruction', 'u8'], ['numberOfShares', 'u64'], ], }, ],
    [ UpdateExternalPriceAccountArgs, { kind: 'struct', fields: [ ['instruction', 'u8'], ['externalPriceAccount', ExternalPriceAccount], ], }, ],
    [ ExternalPriceAccount, { kind: 'struct', fields: [ ['discriminator', 'u64'], ['key', 'u8'], ['pricePerShare', 'u64'], ['priceMint', 'pubkeyAsString'], ['allowedToCombine', 'u8'], ], }, ],
    [ SafetyDepositBox, { kind: 'struct', fields: [ ['key', 'u8'], ['vault', 'pubkeyAsString'], ['tokenMint', 'pubkeyAsString'], ['store', 'pubkeyAsString'], ['order', 'u8'], ], }, ],
]);



module.exports = {
    extendBorsh,
    VAULT_ACCOUNT_SIZE,
    PRICE_ACCOUNT_SIZE,
    InstructionArg,
    InitVaultArgs,
    AmountArgs,
    NumberOfShareArgs,
    ExternalPriceAccount,
    UpdateExternalPriceAccountArgs,
    VAULT_SCHEMA,
    SafetyDepositBox
}