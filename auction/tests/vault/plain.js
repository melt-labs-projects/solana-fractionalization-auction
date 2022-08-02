const splToken = require('@solana/spl-token');
const web3 = require('@solana/web3.js');
const fs = require('fs');
const borsh = require('borsh');
const BN = require('bn.js');
const base58 = require('bs58');

// Local modules
const utils = require('./utils');
const schema = require('./schema');
const instruction = require('./instruction');
const price = require('./price');

// We need this to allow borsh to serialise and deserialise public keys.
schema.extendBorsh();

const findUserPricePDA = async (signer, priceAccount, priceProgramId) => {
    return await web3.PublicKey.findProgramAddress(
        [Buffer.from("user"), signer.toBuffer(), priceAccount.toBuffer(), priceProgramId.toBuffer()], 
        priceProgramId
    );
}


const findPricePDA = async (priceAccount, priceProgramID) => {
    return await web3.PublicKey.findProgramAddress(
        [Buffer.from("price"), priceAccount.toBuffer(), priceProgramID.toBuffer()], 
        priceProgramID
    );
}

const createNativeTokenAccount = async (provider, amount, authority, payer) => {
    let balanceNeeded = await splToken.Token.getMinBalanceRentForExemptAccount(provider.connection);
    let newAccount = web3.Keypair.generate();
    let transaction = new web3.Transaction();
    transaction.add(
        web3.SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: newAccount.publicKey,
            lamports: balanceNeeded + (amount * 1e9),
            space: splToken.AccountLayout.span,
            programId: splToken.TOKEN_PROGRAM_ID,
        }),
        splToken.Token.createInitAccountInstruction(
            splToken.TOKEN_PROGRAM_ID,
            splToken.NATIVE_MINT,
            newAccount.publicKey,
            authority
        )
    );
    await provider.send(transaction, [payer, newAccount]);
    return newAccount.publicKey;
}

const createVault = async (provider, auctionAuthority) => {

    const payer = provider.wallet.payer;
    const connection = provider.connection;
    const priceProgram = price.priceProgram(provider);

    // Create the vault accounts
    const priceAccount = web3.Keypair.generate();
    const vaultAccount = web3.Keypair.generate();
    await provider.send(
        new web3.Transaction().add(
            await utils.createAccount(connection, payer, vaultAccount, schema.VAULT_ACCOUNT_SIZE, instruction.VAULT_PROGRAM_ID)
        ), 
        [vaultAccount]
    );

    // Create the PDAs
    const [vaultPDA, vaultPDABump] = await utils.findVaultPDA(instruction.VAULT_PROGRAM_ID, vaultAccount);
    const [pricePDA, pricePDABump] = await findPricePDA(priceAccount.publicKey, priceProgram.programId);

    // Create the mints
    const redeemMint = splToken.NATIVE_MINT
    const fractionMint = await utils.createMint(connection, payer, vaultPDA);
    const lockedMint = await utils.createMint(connection, payer, payer.publicKey);

    // Create the treasuries
    const redeemTreasury = await createNativeTokenAccount(provider, 0, vaultPDA, payer);  
    const fractionTreasury = await fractionMint.createAccount(vaultPDA);

    // Init the price account
    const storeTokenAccount = web3.Keypair.generate();
    await priceProgram.rpc.initialize(pricePDABump, new BN('1'), { 
        accounts: {
            priceAccount: priceAccount.publicKey,
            storeMint: fractionMint.publicKey,
            redeemMint: redeemMint,
            lockedMint: lockedMint.publicKey,
            store: storeTokenAccount.publicKey,
            storeAuthorityPda: pricePDA,
            signer: payer.publicKey,
            tokenProgram: splToken.TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
            rent: web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [storeTokenAccount, priceAccount]
    });

    await provider.send(
        new web3.Transaction().add(
            instruction.initVaultInstruction(fractionMint, redeemTreasury, fractionTreasury, vaultAccount, payer, priceAccount)
        ), 
        []
    );

    // Another PDA
    const [safetyBoxPDA, safetyBoxPDABump] = await utils.findSafetyBoxPDA(instruction.VAULT_PROGRAM_ID, vaultAccount, lockedMint);

    const storeFromAccount = await lockedMint.createAccount(payer.publicKey);
    const storeAccount = await lockedMint.createAccount(vaultPDA);

    // Put some tokens in the token account
    await lockedMint.mintTo(storeFromAccount, payer.publicKey, [], 1);

    await provider.send(
        new web3.Transaction().add(
            instruction.addTokenToInactiveVaultInstruction(safetyBoxPDA, storeFromAccount, storeAccount, vaultAccount, payer, payer, payer, new BN('1')) 
        ),
        []
    )

    await provider.send(
        new web3.Transaction().add(
            instruction.activateVault(vaultAccount, fractionMint, fractionTreasury, vaultPDA, payer, new BN(1_000_000))
        ),
        []
    )

    let destAccount = await fractionMint.createAccount(payer.publicKey);
    await provider.send(
        new web3.Transaction().add(
            instruction.withdrawSharesFromTreasury(destAccount, fractionTreasury, vaultAccount, vaultPDA, payer, new BN(1_000_000))
        ),
        []
    );
    
    const [userPDA, userPDABump] = await findUserPricePDA(payer.publicKey, priceAccount.publicKey, priceProgram.programId);
    await priceProgram.rpc.addVote(pricePDABump, userPDABump, new BN(510_000), new BN(1e9), {
        accounts: {
            userPda: userPDA,
            priceAccount: priceAccount.publicKey,
            storeMint: fractionMint.publicKey,
            userTokenAccount: destAccount,
            store: storeTokenAccount.publicKey,
            storeAuthorityPda: pricePDA,
            signer: payer.publicKey,
            tokenProgram: splToken.TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
            rent: web3.SYSVAR_RENT_PUBKEY,
        }
    })

    provider.send(
        new web3.Transaction().add(instruction.setAuthority(vaultAccount, payer.publicKey, auctionAuthority)),
        []
    );

    return [
        vaultAccount.publicKey, 
        priceAccount.publicKey,
        fractionTreasury,
        redeemTreasury,
        fractionMint.publicKey,
        lockedMint.publicKey,
        storeAccount,
        destAccount
    ]

}



const decodeSafetyDepositBox = async (connection, pda) => {
    let accountInfo = await connection.getAccountInfo(pda);
    return borsh.deserializeUnchecked(schema.VAULT_SCHEMA, schema.SafetyDepositBox, accountInfo.data);
};

module.exports = {
    createVault,
    decodeSafetyDepositBox
}
