const anchor = require('@project-serum/anchor');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { SystemProgram, SYSVAR_RENT_PUBKEY } = anchor.web3;

describe('escrow-vault', () => {

	// Configure the client to use the local cluster.
	const provider = anchor.Provider.env();
	anchor.setProvider(provider);

	it('Is initialized!', async () => {
		// Add your test here.
		const program = anchor.workspace.EscrowVault;

		// The Account to create.
		const otherMint = anchor.web3.Keypair.generate();
		const fractionalShareMint = anchor.web3.Keypair.generate();
		const redeemTreasuryAccount = anchor.web3.Keypair.generate();
		const fractionTreasuryAccount = anchor.web3.Keypair.generate();
		const vaultAccount = anchor.web3.Keypair.generate();
		const priceAccount = anchor.web3.Keypair.generate();

		const VAULT_PROGRAM_ID = new anchor.web3.PublicKey("FMcRJeEKBjD1LU5UyBHvorpep4hVg48ff2C36NX83vtY");
		const authorityPda = await anchor.web3.PublicKey.findProgramAddress(
			[Buffer.from("vault"), VAULT_PROGRAM_ID.toBuffer(), vaultAccount.publicKey.toBuffer()], 
			VAULT_PROGRAM_ID
		)
		console.log(authorityPda[0].toString(), authorityPda[1])
		
		console.log(
			fractionalShareMint.publicKey.toString(),
			redeemTreasuryAccount.publicKey.toString(),
			fractionTreasuryAccount.publicKey.toString(),
			vaultAccount.publicKey.toString(),
		)

		// const transaction = new anchor.web3.Transaction().add(
		// 	anchor.web3.SystemProgram.createAccount({ 
		// 		fromPubkey: provider.wallet.publicKey, 
		// 		lamports: await provider.connection.getMinimumBalanceForRentExemption(205),
		// 		newAccountPubkey: vaultAccount.publicKey,
		// 		programId: VAULT_PROGRAM_ID,
		// 		space: 205 
		// 	})
		// );
		// await provider.send(transaction, [vaultAccount])

		// const transaction2 = new anchor.web3.Transaction().add(
		// 	anchor.web3.SystemProgram.createAccount({ 
		// 		fromPubkey: provider.wallet.publicKey, 
		// 		lamports: await provider.connection.getMinimumBalanceForRentExemption(42),
		// 		newAccountPubkey: priceAccount.publicKey,
		// 		programId: VAULT_PROGRAM_ID,
		// 		space: 42 
		// 	})
		// );
		// await provider.send(transaction2, [priceAccount])

		await program.rpc.initPrice(otherMint.publicKey, { 
			accounts: {
				priceAccount: priceAccount.publicKey,
				vaultAuthority: provider.wallet.publicKey,
				systemProgram: SystemProgram.programId,
			},
			signers: [priceAccount]
		});

		let counterData = await program.account.externalPriceAccount.fetch(priceAccount.publicKey);
		console.log('count', counterData.priceMint.toString());

		await program.rpc.initializeVault(authorityPda[1], {
			accounts: {
				otherMint: otherMint.publicKey,
				fractionalShareMint: fractionalShareMint.publicKey,
				redeemTreasuryAccount: redeemTreasuryAccount.publicKey,
				fractionTreasuryAccount: fractionTreasuryAccount.publicKey,
				vaultAuthority: provider.wallet.publicKey,
				tokenProgram: TOKEN_PROGRAM_ID,
				priceAccount: priceAccount.publicKey,
				rent: SYSVAR_RENT_PUBKEY,
				systemProgram: SystemProgram.programId,
				pdaAuthority: authorityPda[0],
				vaultProgram: VAULT_PROGRAM_ID,
				vaultAccount: vaultAccount.publicKey
			},
			signers: [fractionalShareMint, redeemTreasuryAccount, fractionTreasuryAccount, vaultAccount, otherMint]
		});

		//let counterData = await program.account.counter.fetch(counterAccount.publicKey);
		//console.log('count', counterData.count.toNumber());
  	});
});

