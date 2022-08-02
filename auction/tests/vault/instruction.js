const web3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');
const borsh = require('borsh');
const schema = require('./schema');

const VAULT_PROGRAM_ID = new web3.PublicKey("FMcRJeEKBjD1LU5UyBHvorpep4hVg48ff2C36NX83vtY");

const updatePriceAccountInstruction = (priceAccount, data) => {
    return new web3.TransactionInstruction({
        keys: [{ pubkey: priceAccount.publicKey, isSigner: true, isWritable: true, },],
        programId: VAULT_PROGRAM_ID,
        data: Buffer.from(borsh.serialize(schema.VAULT_SCHEMA, data))
    })
}

/// Initialize a token vault, starts inactivate. Add tokens in subsequent instructions, then activate.
///   0. `[writable]` Initialized fractional share mint with 0 tokens in supply, authority on mint must be pda of program with seed [prefix, programid]
///   1. `[writable]` Initialized redeem treasury token account with 0 tokens in supply, owner of account must be pda of program like above
///   2. `[writable]` Initialized fraction treasury token account with 0 tokens in supply, owner of account must be pda of program like above
///   3. `[writable]` Uninitialized vault account
///   4. `[]` Authority on the vault
///   5. `[]` Pricing Lookup Address
///   6. `[]` Token program
///   7. `[]` Rent sysvar
const initVaultInstruction = (fractionMint, redeemTreasury, fractionTreasury, vaultAccount, vaultAuthority, priceAccount) => {
    const data = new schema.InitVaultArgs(false);
    return new web3.TransactionInstruction({
        keys: [
            { pubkey: fractionMint.publicKey, isSigner: false, isWritable: true, },
            { pubkey: redeemTreasury, isSigner: false, isWritable: true, },
            { pubkey: fractionTreasury, isSigner: false, isWritable: true, },
            { pubkey: vaultAccount.publicKey, isSigner: false, isWritable: true, },
            { pubkey: vaultAuthority.publicKey, isSigner: false, isWritable: false, },
            { pubkey: priceAccount.publicKey, isSigner: false, isWritable: false, },
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false, },
            { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false, }
        ],
        programId: VAULT_PROGRAM_ID,
        data: Buffer.from(borsh.serialize(schema.VAULT_SCHEMA, data))
    })
}

/// Add a token to a inactive token vault
///   0. `[writable]` Uninitialized safety deposit box account address (will be created and allocated by this endpoint)
///                   Address should be pda with seed of [PREFIX, vault_address, token_mint_address]
///   1. `[writable]` Initialized Token account
///   2. `[writable]` Initialized Token store account with authority of this program, this will get set on the safety deposit box
///   3. `[writable]` Initialized inactive fractionalized token vault
///   4. `[signer]` Authority on the vault
///   5. `[signer]` Payer
///   6. `[signer]` Transfer Authority to move desired token amount from token account to safety deposit
///   7. `[]` Token program
///   8. `[]` Rent sysvar
///   9. `[]` System account sysvar
const addTokenToInactiveVaultInstruction = (safetyBoxPDA, tokenAccount, tokenStoreAccount, vaultAccount, vaultAuthority, payer, transferAuthority, amount) => {
    let data = new schema.AmountArgs(1, amount);
    return new web3.TransactionInstruction({
        keys: [
            { pubkey: safetyBoxPDA, isSigner: false, isWritable: true, },
            { pubkey: tokenAccount, isSigner: false, isWritable: true, },
            { pubkey: tokenStoreAccount, isSigner: false, isWritable: true, },
            { pubkey: vaultAccount.publicKey, isSigner: false, isWritable: true, },
            { pubkey: vaultAuthority.publicKey, isSigner: true, isWritable: false, },
            { pubkey: payer.publicKey, isSigner: true, isWritable: false, },
            { pubkey: transferAuthority.publicKey, isSigner: true, isWritable: false, },
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false, },
            { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false, },
            { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false, }
        ],
        programId: VAULT_PROGRAM_ID,
        data: Buffer.from(borsh.serialize(schema.VAULT_SCHEMA, data))
    })
}

/// Activates the vault, distributing initial shares into the fraction treasury.
/// Tokens can no longer be removed in this state until Combination.
///   0. `[writable]` Initialized inactivated fractionalized token vault
///   1. `[writable]` Fraction mint
///   2. `[writable]` Fraction treasury
///   3. `[]` Fraction mint authority for the program - seed of [PREFIX, program_id]
///   4. `[signer]` Authority on the vault
///   5. `[]` Token program
const activateVault = (vaultAccount, fractionMint, fractionTreasury, vaultPDA, vaultAuthority, numShares) => {
    let data = new schema.NumberOfShareArgs(2, numShares)
    return new web3.TransactionInstruction({
        keys: [
            { pubkey: vaultAccount.publicKey, isSigner: false, isWritable: true, },
            { pubkey: fractionMint.publicKey, isSigner: false, isWritable: true, },
            { pubkey: fractionTreasury, isSigner: false, isWritable: true, },
            { pubkey: vaultPDA, isSigner: false, isWritable: false, },
            { pubkey: vaultAuthority.publicKey, isSigner: true, isWritable: false, },
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false, },
        ],
        programId: VAULT_PROGRAM_ID,
        data: Buffer.from(borsh.serialize(schema.VAULT_SCHEMA, data))
    })
}

/// Withdraws shares from the treasury to a desired account.
///   0. `[writable]` Initialized Destination account for the shares being withdrawn
///   1. `[writable]` Fraction treasury
///   2. `[]` The initialized active token vault
///   3. `[]` PDA-based Transfer authority to move tokens from treasury to your destination[PREFIX, program_id]
///   3. `[signer]` Authority of vault
///   4. `[]` Token program
///   5. `[]` Rent sysvar
const withdrawSharesFromTreasury = (destAccount, fractionTreasury, vaultAccount, vaultPDA, vaultAuthority, numShares) => {
    let data = new schema.NumberOfShareArgs(7, numShares);
    return new web3.TransactionInstruction({
        keys: [
            { pubkey: destAccount, isSigner: false, isWritable: true, },
            { pubkey: fractionTreasury, isSigner: false, isWritable: true, },
            { pubkey: vaultAccount.publicKey, isSigner: false, isWritable: false, },
            { pubkey: vaultPDA, isSigner: false, isWritable: false, },
            { pubkey: vaultAuthority.publicKey, isSigner: true, isWritable: false, },
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false, },
            { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false, },
        ],
        programId: VAULT_PROGRAM_ID,
        data: Buffer.from(borsh.serialize(schema.VAULT_SCHEMA, data))
    })
}

/// This act checks the external pricing oracle for permission to combine and the price of the circulating market cap to do so.
/// If you can afford it, this amount is charged and placed into the redeem treasury for shareholders to redeem at a later time.
/// The treasury then unlocks into Combine state and you can remove the tokens.
///   0. `[writable]` Initialized activated token vault
///   1. `[writable]` Token account containing your portion of the outstanding fraction shares
///   2. `[writable]` Token account of the redeem_treasury mint type that you will pay with
///   3. `[writable]` Fraction mint
///   4. `[writable]` Fraction treasury account
///   5. `[writable]` Redeem treasury account
///   6. `[]` New authority on the vault going forward - can be same authority if you want
///   7. `[signer]` Authority on the vault
///   8. `[signer]` Transfer authority for the token account and outstanding fractional shares account you're transferring from
///   9. `[]` PDA-based Burn authority for the fraction treasury account containing the uncirculated shares seed [PREFIX, program_id]
///   10. `[]` External pricing lookup address
///   11. `[]` Token program
const combineVault = (
    vaultAccount, srcAccount, redeemAccount, fractionMint, fractionTreasury, redeemTreasury, newAuthority,
    vaultAuthority, srcAccountAuthority, vaultPDA, priceAccount, data
) => {
    return new web3.TransactionInstruction({
        keys: [
            { pubkey: vaultAccount.publicKey, isSigner: false, isWritable: true, },
            { pubkey: srcAccount, isSigner: false, isWritable: true, },
            { pubkey: redeemAccount, isSigner: false, isWritable: true, },
            { pubkey: fractionMint.publicKey, isSigner: false, isWritable: true, },
            { pubkey: fractionTreasury, isSigner: false, isWritable: true, },
            { pubkey: redeemTreasury, isSigner: false, isWritable: true, },
            { pubkey: newAuthority.publicKey, isSigner: true, isWritable: false, },
            { pubkey: vaultAuthority.publicKey, isSigner: true, isWritable: false, },
            { pubkey: srcAccountAuthority.publicKey, isSigner: true, isWritable: false, },
            { pubkey: vaultPDA, isSigner: false, isWritable: false, },
            { pubkey: priceAccount.publicKey, isSigner: false, isWritable: false, },
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false, }
        ],
        programId: VAULT_PROGRAM_ID,
        data: Buffer.from(borsh.serialize(schema.VAULT_SCHEMA, data))
    })
}

/// If in combine state, authority on vault can hit this to withdrawal some of a token type from a safety deposit box.
/// Once fractional supply is zero and all tokens have been removed this action will take vault to Deactivated
///   0. `[writable]` Initialized Destination account for the tokens being withdrawn
///   1. `[writable]` The safety deposit box account key for the tokens
///   2. `[writable]` The store key on the safety deposit box account
///   3. `[writable]` The initialized combined token vault
///   4. `[]` Fraction mint
///   5. `[signer]` Authority of vault
///   6. `[]` PDA-based Transfer authority to move the tokens from the store to the destination seed [PREFIX, program_id]
///   7. `[]` Token program
///   8. `[]` Rent sysvar
const withdrawTokenFromSafetyDepositBox = (destAccount, safetyBoxPDA, storeAccount, vaultAccount, fractionMint, vaultAuthority, vaultPDA, data) => {
    return new web3.TransactionInstruction({
        keys: [
            { pubkey: destAccount, isSigner: false, isWritable: true, },
            { pubkey: safetyBoxPDA, isSigner: false, isWritable: true, },
            { pubkey: storeAccount, isSigner: false, isWritable: true, },
            { pubkey: vaultAccount.publicKey, isSigner: false, isWritable: true, },
            { pubkey: fractionMint.publicKey, isSigner: false, isWritable: false, },
            { pubkey: vaultAuthority.publicKey, isSigner: false, isWritable: false, },
            { pubkey: vaultPDA, isSigner: false, isWritable: false, },
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false, },
            { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false, },
        ],
        programId: VAULT_PROGRAM_ID,
        data: Buffer.from(borsh.serialize(schema.VAULT_SCHEMA, data))
    })
}

/// Sets the authority of the vault to a new authority.
///
///   0. `[writable]` Vault
///   1. `[signer]` Vault authority
///   2. `[]` New authority
const setAuthority = (vaultAccount, vaultAuthority, newAuthority) => {
    let data = new schema.InstructionArg(10);
    return new web3.TransactionInstruction({
        keys: [
            { pubkey: vaultAccount.publicKey, isSigner: false, isWritable: true, },
            { pubkey: vaultAuthority, isSigner: true, isWritable: false, },
            { pubkey: newAuthority, isSigner: false, isWritable: false, },
        ],
        programId: VAULT_PROGRAM_ID,
        data: Buffer.from(borsh.serialize(schema.VAULT_SCHEMA, data))
    })
}

module.exports = {
    VAULT_PROGRAM_ID,
    updatePriceAccountInstruction,
    initVaultInstruction,
    addTokenToInactiveVaultInstruction,
    activateVault,
    withdrawSharesFromTreasury,
    combineVault,
    withdrawTokenFromSafetyDepositBox,
    setAuthority
}