const fs = require('fs');
const web3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');

const findVaultPDA = async (vaultProgramId, vaultAccount) => {
    return web3.PublicKey.findProgramAddress(
        [Buffer.from("vault"), vaultProgramId.toBuffer(), vaultAccount.publicKey.toBuffer()], 
        vaultProgramId
    );
}

const findSafetyBoxPDA = async (vaultProgramId, vaultAccount, mint) => {
    return web3.PublicKey.findProgramAddress(
        [Buffer.from("vault"), vaultAccount.publicKey.toBuffer(), mint.publicKey.toBuffer()], 
        vaultProgramId
    );
}

const loadFileWallet = () => {
    const keypairPath = '/Users/fayd/.config/solana/id.json';
    const data = fs.readFileSync(keypairPath, 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(data));
    return web3.Keypair.fromSecretKey(secretKey);
}

const createAccount = async (connection, payer, account, space, programId) => {
    return await web3.SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: account.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(space),
        space,
        programId
    })
}

const DECIMALS = 9;
const createMint = async (connection, payer, authority) => {
    return await splToken.Token.createMint(
        connection, payer, 
        authority, // mint authority
        authority, // freeze authority
        DECIMALS, splToken.TOKEN_PROGRAM_ID,
    );
}

module.exports = {
    loadFileWallet, 
    findSafetyBoxPDA,
    findVaultPDA, 
    createAccount, 
    createMint,
}