const anchor = require('@project-serum/anchor');
const { TOKEN_PROGRAM_ID, NATIVE_MINT, Token, AccountLayout } = require('@solana/spl-token');
const { assert } = require('chai');
const { PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram, Keypair, Transaction } = anchor.web3;
const vaultProgram = require("./vault/plain");

const VAULT_PROGRAM_ID = new PublicKey("FMcRJeEKBjD1LU5UyBHvorpep4hVg48ff2C36NX83vtY");

const getTokenAccountBalance = async (connection, address) => {
	return parseInt((await connection.getTokenAccountBalance(address)).value.amount);
}

const assertError = async (call, message) => {
	try {
		await call();
		assert.ok(false);
	} catch (err) {
		if (message === undefined) return;
		assert.equal(err.toString(), message);
	}
}

const createNativeTokenAccount = async (provider, amount, user) => {
	let balanceNeeded = await Token.getMinBalanceRentForExemptAccount(provider.connection);
	let newAccount = Keypair.generate();
	let transaction = new Transaction();
	transaction.add(
		SystemProgram.createAccount({
			fromPubkey: user.publicKey,
			newAccountPubkey: newAccount.publicKey,
			lamports: balanceNeeded + (amount * 1e9),
			space: AccountLayout.span,
			programId: TOKEN_PROGRAM_ID,
		}),
		Token.createInitAccountInstruction(
			TOKEN_PROGRAM_ID,
			NATIVE_MINT,
			newAccount.publicKey,
			user.publicKey,
		)
	);
	await provider.send(transaction, [user, newAccount]);
	return newAccount.publicKey;
};

const findAuctionAccount = async (_program, _settingsAccount, _vaultAccount) => {
	return await PublicKey.findProgramAddress(
		[Buffer.from("auction"), _vaultAccount.toBuffer()], 
		_program.programId
	);
};

const findVaultPDA = async (_vaultAccount) => {
	return await PublicKey.findProgramAddress(
		[Buffer.from("vault"), VAULT_PROGRAM_ID.toBuffer(), _vaultAccount.toBuffer()], 
		VAULT_PROGRAM_ID
	); 
};

const findBidAccount = async (_program, _auctionAccount, _bidder) => {
	return await PublicKey.findProgramAddress(
		[Buffer.from("bid"), _bidder.toBuffer(), _auctionAccount.toBuffer()], 
		_program.programId
	);
};

const findSafetyBox = async (_vaultAccount, _mint) => {
	return PublicKey.findProgramAddress(
		[Buffer.from("vault"), _vaultAccount.toBuffer(), _mint.toBuffer()], 
		VAULT_PROGRAM_ID
	);
};

describe('auction', () => {

	const provider = anchor.Provider.env();
	//const provider = new anchor.Provider(defaultProvider.connection, defaultProvider.wallet, { skipPreflight: true });
	const connection = provider.connection;
	anchor.setProvider(provider);
	const program = anchor.workspace.Auction;
	const payer = provider.wallet.payer;

	// Variables for the vault
	var vault;
	var externalPricingAccount;
	var vaultFractionTreasury;
	var vaultRedeemTreasury;
	var fractionMint;
	var lockedMint;
	var storeAccount;
	var destAccount;

	// Variables for the auction
	var settings;
	var authority;

	const lockedTreasuryKeypair = Keypair.generate();
	const lockedTreasury = lockedTreasuryKeypair.publicKey;

	let paymentTreasuryKeypair = Keypair.generate();
	let paymentTreasury = paymentTreasuryKeypair.publicKey;

	
	// Variables for the settings
	const duration = new anchor.BN(10);
	const softClose = new anchor.BN(0);
	const bidIncrement = new anchor.BN(1e8);
	const facilitatorFee = new anchor.BN(0);

	const start = async (bidAmount, payAmount, user) => {

		let payingTokenAccount = await createNativeTokenAccount(provider, payAmount, payer);

		let vaultPda = (await findVaultPDA(vault))[0];
		let fractionMintToken = new Token(connection, fractionMint, TOKEN_PROGRAM_ID, payer);
		let outstandingFractionsTokenAccount = await fractionMintToken.createAccount(payer.publicKey);

		// Find the auction and bid accounts
		let [auction, auctionBump] = await findAuctionAccount(program, settings, vault);
		let [bid, bidBump] = await findBidAccount(program, auction, user.publicKey);

		// Start the auction
		let bidTokenAccountKeypair = Keypair.generate();
		let bidTokenAccount = bidTokenAccountKeypair.publicKey;

		await program.rpc.start(auctionBump, bidBump, new anchor.BN(bidAmount * 1e9), {
			accounts: {
				authority,
				auction,
				settings,
				vault,
				externalPricingAccount,
				vaultPda,
				
				vaultFractionTreasury,
				vaultRedeemTreasury,
				paymentTreasury,
				bid,
				bidTokenAccount,
				payingTokenAccount,
				outstandingFractionsTokenAccount,

				paymentMint: NATIVE_MINT,
				fractionMint,
			
				bidder: user.publicKey,
				tokenProgram: TOKEN_PROGRAM_ID,
				rent: SYSVAR_RENT_PUBKEY,
				systemProgram: SystemProgram.programId,
				vaultProgram: VAULT_PROGRAM_ID,
				
			},
			signers: [paymentTreasuryKeypair, bidTokenAccountKeypair]
		});

	};

	const topBidInfo = async (_auction) => {
		let auctionAccount = await program.account.auction.fetch(_auction);
		let topBidAddress = (await findBidAccount(program, _auction, auctionAccount.topBidder))[0];
		let topBidAccount = await program.account.bid.fetch(topBidAddress);
		return [topBidAddress, topBidAccount.tokenAccount];
	}

	const createUser = async (_balance) => {
		let airdropAmount = anchor.web3.LAMPORTS_PER_SOL * _balance;
		let user = Keypair.generate();
		let sig = await provider.connection.requestAirdrop(user.publicKey, airdropAmount);
		await provider.connection.confirmTransaction(sig);
		return user;
	}

	const bid = async (_user, _amount) => {
		let payingTokenAccount = await createNativeTokenAccount(provider, _amount, _user);
		let auction = (await findAuctionAccount(program, settings, vault))[0];
		let [bid, bidBump] = await findBidAccount(program, auction, _user.publicKey);
		let bidTokenAccountKeypair = Keypair.generate();
		let bidTokenAccount = bidTokenAccountKeypair.publicKey;
		let [topBid, topBidTokenAccount] = await topBidInfo(auction);
		let topBidData = await program.account.bid.fetch(topBid);

		let payingAccountBalanceBefore = await connection.getBalance(payingTokenAccount);
		let paymentTreasuryBalanceBefore = await connection.getBalance(paymentTreasury);
		let topBidAccountBalanceBefore = await connection.getBalance(topBidTokenAccount);
		let paymentAmount = new anchor.BN(1e9 * _amount);

		await program.rpc.placeBid(bidBump, paymentAmount, {
			accounts: {
				auction,
				settings,
				vault,
				paymentTreasury,
				topBid,
				topBidTokenAccount,
				bid,
				bidTokenAccount,
				paymentMint: NATIVE_MINT,
				payingTokenAccount,
				bidder: _user.publicKey,
				tokenProgram: TOKEN_PROGRAM_ID,
				rent: SYSVAR_RENT_PUBKEY,
				systemProgram: SystemProgram.programId,
			},
			signers: [bidTokenAccountKeypair, _user]
		});

		let payingAccountBalanceAfter = await connection.getBalance(payingTokenAccount);
		let paymentTreasuryBalanceAfter = await connection.getBalance(paymentTreasury);
		let topBidAccountBalanceAfter = await connection.getBalance(topBidTokenAccount);
		let bidIncrease = paymentAmount.toNumber() - topBidData.amount.toNumber() 
		assert.equal(payingAccountBalanceBefore - payingAccountBalanceAfter, paymentAmount.toNumber());
		assert.equal(paymentTreasuryBalanceAfter - paymentTreasuryBalanceBefore, bidIncrease);
		assert.equal(topBidAccountBalanceAfter - topBidAccountBalanceBefore, topBidData.amount.toNumber() );

	}

	const withdrawBid = async (_user) => {
		let toAccount = await createNativeTokenAccount(provider, 0, _user);
		let auction = (await findAuctionAccount(program, settings, vault))[0];
		let bid = (await findBidAccount(program, auction, _user.publicKey))[0];
		let bidAccount = await program.account.bid.fetch(bid);
		let bidTokenAccount = bidAccount.tokenAccount;

		let toAccountBalanceBefore = await connection.getBalance(toAccount);

		await program.rpc.withdrawBid({
			accounts: {
				auction,
				settings,
				vault,
				bid,
				bidTokenAccount,
				toAccount,
				bidder: _user.publicKey,
				tokenProgram: TOKEN_PROGRAM_ID,
			},
			signers: [_user]
		});

		let toAccountBalanceAfter = await connection.getBalance(toAccount);
		assert.equal(toAccountBalanceAfter - toAccountBalanceBefore, bidAccount.amount.toNumber());
	}

	const claim = async (_user) => {
		let auction = (await findAuctionAccount(program, settings, vault))[0];
		let vaultPda = (await findVaultPDA(vault))[0];
		let safetyDepositBox = (await findSafetyBox(vault, lockedMint))[0];
		let safetyBoxAccount = await vaultProgram.decodeSafetyDepositBox(connection, safetyDepositBox);
        let lockedTokenAccount = new PublicKey(safetyBoxAccount.data.store);
		let lockedMintToken = new Token(connection, lockedMint, TOKEN_PROGRAM_ID, _user);
		let destinationTokenAccount = await lockedMintToken.createAccount(_user.publicKey);

		let destAccountBalanceBefore = await getTokenAccountBalance(connection, destinationTokenAccount);
		let lockedAccountBalanceBefore = await getTokenAccountBalance(connection, lockedTokenAccount);

		await program.rpc.claim(new anchor.BN(1), {
			accounts: {
				authority,
				auction,
				settings,
				vault,
				destinationTokenAccount,
				bidder: _user.publicKey,
				tokenProgram: TOKEN_PROGRAM_ID,
				lockedTokenAccount,
				safetyDepositBox,
				vaultPda,
				vaultProgram: VAULT_PROGRAM_ID,
				fractionMint,
				rent: SYSVAR_RENT_PUBKEY
			},
			signers: [_user]
		});

		let destAccountBalanceAfter = await getTokenAccountBalance(connection, destinationTokenAccount);
		let lockedAccountBalanceAfter = await getTokenAccountBalance(connection, lockedTokenAccount);
		assert.equal(destAccountBalanceAfter - destAccountBalanceBefore, 1);
		assert.equal(lockedAccountBalanceBefore - lockedAccountBalanceAfter, 1);
	}

	const redeem = async (_user) => {
		let destinationTokenAccount = await createNativeTokenAccount(provider, 0, _user);
		let auction = (await findAuctionAccount(program, settings, vault))[0];
		let vaultPda = (await findVaultPDA(vault))[0];

		let paymentTreasuryBalanceBefore = await connection.getBalance(paymentTreasury);
		let destAccountBalanceBefore = await connection.getBalance(destinationTokenAccount);
		let redeemTreasuryBalanceBefore = await connection.getBalance(vaultRedeemTreasury);

		await program.rpc.redeem({
			accounts: {
				auction,
				settings,
				vault,
				redeemTreasury: vaultRedeemTreasury,
				paymentTreasury,
				destinationTokenAccount,
				sourceTokenAccount: destAccount,
				redeemer: _user.publicKey,
				vaultPda,
				vaultProgram: VAULT_PROGRAM_ID,
				fractionMint,
				tokenProgram: TOKEN_PROGRAM_ID,
				rent: SYSVAR_RENT_PUBKEY,
				systemProgram: SystemProgram.programId,
			},
			signers: [_user]
		});

		let paymentTreasuryBalanceAfter = await connection.getBalance(paymentTreasury);
		let destAccountBalanceAfter = await connection.getBalance(destinationTokenAccount);
		let redeemTreasuryBalanceAfter = await connection.getBalance(vaultRedeemTreasury);
		let sourceAccountBalanceAfter = await getTokenAccountBalance(connection, destAccount);
		let amountRetrieved = destAccountBalanceAfter - destAccountBalanceBefore;
		let amountRetrievedFromVault = redeemTreasuryBalanceBefore - redeemTreasuryBalanceAfter;
		let amountRetrievedFromAuction = paymentTreasuryBalanceBefore - paymentTreasuryBalanceAfter;

		assert.equal(sourceAccountBalanceAfter, 0);
		assert.equal(amountRetrieved, amountRetrievedFromAuction + amountRetrievedFromVault);
	};

	it('init authority', async () => {

		// Create the authority
		let authorityArray = await PublicKey.findProgramAddress(
			[Buffer.from("authority"), program.programId.toBuffer()], 
			program.programId
		);
		authority = authorityArray[0];

		// Initialise the program with the signer as the owner
		// await program.rpc.init(authorityArray[1], {
		// 	accounts: {
		// 		authority,
		// 		signer: payer.publicKey,
		// 		rent: SYSVAR_RENT_PUBKEY,
		// 		systemProgram: SystemProgram.programId,
		// 	}
		// });
		
		// Check that the authority data fields have been populated correctly
		let authorityData = await program.account.authority.fetch(authority);
		assert.deepEqual(authorityData.owner, payer.publicKey);
		assert.equal(authorityData.bump, authorityArray[1]);

	});

	it('should create and configure new active vault', async () => {
		// Create a new vault for testing the auction
		[
			vault, 
			externalPricingAccount, 
			vaultFractionTreasury, 
			vaultRedeemTreasury, 
			fractionMint, 
			lockedMint, 
			storeAccount, 
			destAccount
		] = await vaultProgram.createVault(provider, authority);
	})

	it('create settings', async () => {

		// Create some new auction settings
		const keypair = Keypair.generate();
		settings = keypair.publicKey;
		await program.rpc.createSettings(duration, softClose, bidIncrement, facilitatorFee, {
			accounts: {
				authority,
				settings,
				owner: payer.publicKey,
				rent: SYSVAR_RENT_PUBKEY,
				systemProgram: SystemProgram.programId,
			},
			signers: [keypair]
		});

		// Check that the settings data has been populated correctly
		let settingsData = await program.account.settings.fetch(settings);
		assert.isTrue(settingsData.duration.eq(duration));
		assert.isTrue(settingsData.softClosePeriod.eq(softClose));
		assert.isTrue(settingsData.bidIncrement.eq(bidIncrement));
		assert.isTrue(settingsData.facilitatorFee.eq(facilitatorFee));

		// console.log("VAULT:", vault.toString());
		// console.log("SETTINGS:", settings.toString());

	});

	it('only authority can create settings', async () => {

		let keypair = Keypair.generate();
		let user = await createUser(1);
		let call = async () => {
			await program.rpc.createSettings(duration, softClose, bidIncrement, facilitatorFee, {
				accounts: {
					authority,
					settings: keypair.publicKey,
					owner: user.publicKey,
					rent: SYSVAR_RENT_PUBKEY,
					systemProgram: SystemProgram.programId,
				},
				signers: [user, keypair]
			});
		};

		await assertError(call);

	});

	it('start auction', async () => {
		await start(1, 1, payer);
	});

	it('cannot start auction more than once', async () => {
		let call = async () => await start(1, 1, payer);
		await assertError(call);
	});

	describe('bidding', () => {

		var userA = payer;
		var userB;
		var userC;

		before(async () => {
			userB = await createUser(5);
			userC = await createUser(5);
		});

		it('cannot place bid smaller than current top bid', async () => {
			let call = async () => await bid(userC, 0.95);
			await assertError(call, "The bid is either not larger or not sufficiently larger than the current bid");
		});

		it('cannot place bid smaller than minimum increment', async () => {
			let call = async () => await bid(userC, 1.01);
			await assertError(call, "The bid is either not larger or not sufficiently larger than the current bid");
		});

		it('place bids', async () => {
			await bid(userB, 1.1);
			await bid(userC, 1.3);
		});

		it('same address cannot place multiple bids at once', async () => {
			let call = async () => await bid(userC, 1.5);
			await assertError(call);
		});

		it('top bid cannot be withdrawn', async () => {
			let call = async () => await withdrawBid(userC);
			await assertError(call, "Top bid cannot be withdrawn");
		});

		it('withdraw bids', async () => {
			await withdrawBid(userA);
			await withdrawBid(userB);
		});

		it('wait for auction to finish', async () => {
			await new Promise(r => setTimeout(r, 5000));
		});

		it('only winner can claim auctioned asset', async () => {
			let call = async () => await claim(userA);
			await assertError(call, "Only the auction winner can claim the winnings");
		});

		it('officially end (for fees)', async () => {
			let feeTokenAccount = await createNativeTokenAccount(provider, 0, payer);
			let auction = (await findAuctionAccount(program, settings, vault))[0];
			await program.rpc.end({
				accounts : {
					authority,
					auction,
					vault,
					settings,
					paymentTreasury,
					feeTokenAccount,
					tokenProgram: TOKEN_PROGRAM_ID
				}
			});
		})

		it('claim auctioned asset', async () => {
			await claim(userC);
		});

		it('should redeem', async () => {
			await redeem(payer);
		});

		it('cannot be after auction ends', async () => {
			let call = async () => await bid(userA, 1.5);
			await assertError(call, "The auction has already finished");
		});


	});

});
