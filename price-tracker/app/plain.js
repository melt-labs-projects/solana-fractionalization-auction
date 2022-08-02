const splToken = require('@solana/spl-token');
const web3 = require('@solana/web3.js');
const fs = require('fs');
const borsh = require('borsh');
const { assert } = require('chai');
const BN = require('bn.js');
const base58 = require('bs58');

// Local modules
const utils = require('./utils');
const schema = require('./schema');
const instruction = require('./instruction');

// We need this to allow borsh to serialise and deserialise public keys.
schema.extendBorsh();


describe('escrow-vault', () => {

    // Create a connection to localhost
    const connection = new web3.Connection('http://127.0.0.1:8899', 'confirmed');

    // Load file wallet to fund transactions
    const payer = utils.loadFileWallet();

    // Mints
    var depositTokenMint; // Token to lock
    var redeemMint; // Token to pay with
    var fractionMint; // Fractional token

    // Token Accounts
    var redeemTreasury;
    var fractionTreasury;

    var vaultAccount = web3.Keypair.generate();
    var priceAccount = web3.Keypair.generate();

    
    var vaultPDA;
    var vaultPDABump;

    var safetyBoxPDA;
    var safetyBoxPDABump;

    var storeAccount; // TokenAccount for depositToken in Vault

    before(async () => {
        [vaultPDA, vaultPDABump] = await utils.findVaultPDA(instruction.VAULT_PROGRAM_ID, vaultAccount)
    })

    it('should InitVault', async () => {

        // Create mints
        redeemMint = await utils.createMint(connection, payer, payer.publicKey);
        fractionMint = await utils.createMint(connection, payer, vaultPDA);

        // Create token accounts owned by vaultPDA
        redeemTreasury = await redeemMint.createAccount(vaultPDA);
        fractionTreasury = await fractionMint.createAccount(vaultPDA);
        
        // Create data needed for transactions
        let externalPriceAccount = new schema.ExternalPriceAccount(new BN(0), redeemMint.publicKey.toBase58(), false);
        const updateExternalPriceAccountArgs = new schema.UpdateExternalPriceAccountArgs(externalPriceAccount);
        const initVaultArgs = new schema.InitVaultArgs(false);

        let transaction = new web3.Transaction().add(

            // 1. Create vault account
            await utils.createAccount(connection, payer, vaultAccount, schema.VAULT_ACCOUNT_SIZE, instruction.VAULT_PROGRAM_ID),

            // 2. Create price account
            await utils.createAccount(connection, payer, priceAccount, schema.PRICE_ACCOUNT_SIZE + 8, instruction.VAULT_PROGRAM_ID),

            // 3. Update price account
            instruction.updatePriceAccountInstruction(priceAccount, updateExternalPriceAccountArgs),

            // 4. Initialise vault
            instruction.initVaultInstruction(fractionMint, redeemTreasury, fractionTreasury, vaultAccount, payer, priceAccount, initVaultArgs)

        )

        await web3.sendAndConfirmTransaction(connection, transaction, [payer, vaultAccount, priceAccount, priceAccount]);

    })

    it('should AddTokenToInactiveVault', async () => {

        // New mint for deposit token
        depositTokenMint = await utils.createMint(connection, payer, payer.publicKey);

        [safetyBoxPDA, safetyBoxPDABump] = await utils.findSafetyBoxPDA(instruction.VAULT_PROGRAM_ID, vaultAccount, depositTokenMint)

        // Create token accounts
        let tokenAccount = await depositTokenMint.createAccount(payer.publicKey);
        storeAccount = await depositTokenMint.createAccount(vaultPDA);

        // Put some tokens in the token account
        await depositTokenMint.mintTo(tokenAccount, payer.publicKey, [], 1);

        let amountToDeposit = new BN(1);
        let amountArgs = new schema.AmountArgs(1, amountToDeposit);
        let transaction = new web3.Transaction().add(
            instruction.addTokenToInactiveVaultInstruction(safetyBoxPDA, tokenAccount, storeAccount, vaultAccount, payer, payer, payer, amountArgs) 
        )

        await web3.sendAndConfirmTransaction(connection, transaction, [payer]);

    })

    it('should ActivateVault', async () => {

        let numShares = new BN(1_000_000);
        let shareArgs = new schema.NumberOfShareArgs(2, numShares);
        let transaction = new web3.Transaction().add(
            instruction.activateVault(vaultAccount, fractionMint, fractionTreasury, vaultPDA, payer, shareArgs)
        )

        await web3.sendAndConfirmTransaction(connection, transaction, [payer]);

    })

    it('should WithdrawSharesFromTreasury', async () => {

        let destAccount = await fractionMint.createAccount(payer.publicKey);

        let numShares = new BN(1_000_000);
        let shareArgs = new schema.NumberOfShareArgs(7, numShares);
        let transaction = new web3.Transaction().add(
            instruction.withdrawSharesFromTreasury(destAccount, fractionTreasury, vaultAccount, vaultPDA, payer, shareArgs)
        )

        await web3.sendAndConfirmTransaction(connection, transaction, [payer]);

        // let balance = await connection.getTokenAccountBalance(destAccount);
        // console.log("Balance", balance);

    })

    it("should transfer ownership", async () => {
        let otherProgramId = new web3.PublicKey("Mc7M4H2xrNUiEgQW7VMsamPzSaM74AMsVaoSPdAZ8eV");
        let vaultAccount = { publicKey: new web3.PublicKey("FJvrUtEyDq7b5ueZBw7pEu5s82vEpGYkoUbij4sBmiwA") };
        const [pda, bump] = await web3.PublicKey.findProgramAddress(
            [Buffer.from("authority"), instruction.VAULT_PROGRAM_ID.toBuffer()], 
            otherProgramId
        );

        let transaction = new web3.Transaction().add(
            instruction.setAuthority(vaultAccount, payer.publicKey, pda)
        )
        console.log(vaultAccount.publicKey.toString())

        await web3.sendAndConfirmTransaction(connection, transaction, [payer]);
        
    })

    // it('should CombineVault', async () => {

    //     let srcAccount = await fractionMint.createAccount(payer.publicKey);
    //     let redeemAccount = await redeemMint.createAccount(payer.publicKey);

    //     await redeemMint.mintTo(redeemAccount, payer.publicKey, [], 1000000);

    //     let externalPriceAccount = new schema.ExternalPriceAccount(new BN(1), redeemMint.publicKey.toBase58(), true);
    //     let updateExternalPriceAccountArgs = new schema.UpdateExternalPriceAccountArgs(externalPriceAccount);

    //     let instructionArg = new schema.InstructionArg(3);
    //     let transaction = new web3.Transaction().add(
    //         instruction.updatePriceAccountInstruction(priceAccount, updateExternalPriceAccountArgs),
    //         instruction.combineVault(vaultAccount, srcAccount, redeemAccount, fractionMint, 
    //             fractionTreasury, redeemTreasury, payer, payer, payer, vaultPDA, priceAccount, instructionArg)
    //     )

    //     await web3.sendAndConfirmTransaction(connection, transaction, [payer, priceAccount]);

    // })

    // it('should WithdrawTokenFromSafetyDepositBox', async () => {

    //     let destAccount = await depositTokenMint.createAccount(payer.publicKey);

    //     let amountToWithdraw = new BN(1);
    //     let amountArgs = new schema.AmountArgs(5, amountToWithdraw);
    //     let transaction = new web3.Transaction().add(
    //         instruction.withdrawTokenFromSafetyDepositBox(destAccount, safetyBoxPDA, storeAccount, vaultAccount, fractionMint, payer, vaultPDA, amountArgs)
    //     )
    //     await web3.sendAndConfirmTransaction(connection, transaction, [payer]);

    // })

})