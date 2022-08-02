const anchor = require('@project-serum/anchor');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { SystemProgram, SYSVAR_RENT_PUBKEY, Keypair, Transaction } = anchor.web3;
const splToken = require('@solana/spl-token');
const { assert } = require('chai');
const BN = require('bn.js');

describe('price-tracker', () => {

	// Configure the client to use the local cluster.
	const provider = anchor.Provider.env();
	let connection = provider.connection;
	anchor.setProvider(provider);
	const program = anchor.workspace.PriceTracker;
	const DECIMALS = 9;
	const user = provider.wallet.publicKey;
	const payer = provider.wallet.payer;

	// Some accounts
	const storeTokenAccount = anchor.web3.Keypair.generate();
    const priceAccount = anchor.web3.Keypair.generate();
	console.log(priceAccount.publicKey.toBase58());
	var userTokenAccount;

	// Mints
	var storeMint;
	var redeemMint
	var lockedMint;

	// PDAs
	var authorityPda;
	var authorityPdaBump;

	// Params
	const minPrice = new BN(10 * 10**DECIMALS);

	const getTokenAccountBalance = async (address) => {
		let res = await connection.getTokenAccountBalance(address);
		return new BN(res.value.amount);
	}

	const createMint = async (decimals) => {
		return await splToken.Token.createMint(
			provider.connection, provider.wallet.payer, 
			user, // mint authority
			user, // freeze authority
			decimals, splToken.TOKEN_PROGRAM_ID,
		);
	}

	const addVotes = async (votes, price, fromAccount, owner=payer, priceAcc=priceAccount) => {
		votes = new BN((votes * 10**DECIMALS).toString());
		price = new BN((price * 10**DECIMALS).toString());

		let fromBalanceBefore = await getTokenAccountBalance(fromAccount);
		let storeBalanceBefore = await getTokenAccountBalance(storeTokenAccount.publicKey);

		let [userPda, userPdaBump] = await anchor.web3.PublicKey.findProgramAddress(
			[Buffer.from("user"), owner.publicKey.toBuffer(), priceAcc.publicKey.toBuffer(), program.programId.toBuffer()], 
			program.programId
		);

		await program.rpc.addVote(authorityPdaBump, userPdaBump, votes, price, {
			accounts: {
				userPda: userPda,
				priceAccount: priceAcc.publicKey,
				storeMint: storeMint.publicKey,
				userTokenAccount: fromAccount,
                store: storeTokenAccount.publicKey,
                storeAuthorityPda: authorityPda,
				signer: owner.publicKey,
				tokenProgram: TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
			},
			signers: [owner]
		})

		let fromBalanceAfter = await getTokenAccountBalance(fromAccount);
		let storeBalanceAfter = await getTokenAccountBalance(storeTokenAccount.publicKey);

		assert.equal(fromBalanceBefore.sub(fromBalanceAfter).toString(), votes.toString());
		assert.equal(storeBalanceAfter.sub(storeBalanceBefore).toString(), votes.toString());
	}

	const removeVotes = async (votes, toAccount, owner=payer, priceAcc=priceAccount) => {
		votes = new BN((votes * 10**DECIMALS).toString());

		let toBalanceBefore = await getTokenAccountBalance(toAccount);
		let storeBalanceBefore = await getTokenAccountBalance(storeTokenAccount.publicKey);

		let [userPda, userPdaBump] = await anchor.web3.PublicKey.findProgramAddress(
			[Buffer.from("user"), owner.publicKey.toBuffer(), priceAcc.publicKey.toBuffer(), program.programId.toBuffer()], 
			program.programId
		);

		await program.rpc.removeVote(authorityPdaBump, userPdaBump, votes, {
			accounts: {
				userPda: userPda,
				priceAccount: priceAcc.publicKey,
				storeMint: storeMint.publicKey,
				userTokenAccount: toAccount,
                store: storeTokenAccount.publicKey,
                storeAuthorityPda: authorityPda,
				signer: owner.publicKey,
				tokenProgram: TOKEN_PROGRAM_ID,
			},
			signers: [owner]
		});

		let toBalanceAfter = await getTokenAccountBalance(toAccount);
		let storeBalanceAfter = await getTokenAccountBalance(storeTokenAccount.publicKey);

		assert.equal(toBalanceAfter.sub(toBalanceBefore).toString(), votes.toString());
		assert.equal(storeBalanceBefore.sub(storeBalanceAfter).toString(), votes.toString());
	}

	const setMinPrice = async (price, owner=provider.wallet.payer) => {
		price = new BN((price * 10**DECIMALS).toString());
		await program.rpc.setMinPrice(authorityPdaBump, price, {
			accounts: {
				priceAccount: priceAccount.publicKey,
                storeAuthorityPda: authorityPda,
				authority: owner.publicKey
			},
			signers: [owner]
		});
	}

	const checkTokenInfo = async (totalVotes, reserveTotal, minimumPrice) => {
		totalVotes = new BN((totalVotes * 10**DECIMALS).toString())
		reserveTotal = new BN((reserveTotal * 10**DECIMALS).toString())
		minimumPrice = new BN((minimumPrice * 10**DECIMALS).toString())

		let tokenInfo = await program.account.tokenInfo.fetch(authorityPda);
		assert.equal(tokenInfo.reserveTotal.toString(), reserveTotal.toString());
		assert.equal(tokenInfo.totalVotes.toString(), totalVotes.toString());
		assert.equal(tokenInfo.minPrice.toString(), minimumPrice.toString());

		// These should always remain the same
		assert.equal(tokenInfo.mint.toString(), storeMint.publicKey.toString());
		assert.equal(tokenInfo.store.toString(), storeTokenAccount.publicKey.toString());
		assert.equal(tokenInfo.lockedMint.toString(), lockedMint.publicKey.toString());
		assert.equal(tokenInfo.authority.toString(), provider.wallet.publicKey.toString());
	}

	const checkUserInfo = async (votes, price, owner=payer) => {
		let [userPda, _] = await anchor.web3.PublicKey.findProgramAddress(
			[Buffer.from("user"), owner.publicKey.toBuffer(), priceAccount.publicKey.toBuffer(), program.programId.toBuffer()], 
			program.programId
		);
		votes = new BN((votes * 10**DECIMALS).toString())
		price = new BN((price * 10**DECIMALS).toString())
		let userInfo = await program.account.userInfo.fetch(userPda);
		assert.equal(userInfo.votes.toString(), votes.toString());
		assert.equal(userInfo.price.toString(), price.toString());
	}

	const checkExternalPriceInfo = async (price, canCombine) => {
		price = new BN((price * 10**DECIMALS).toString())
		let externalPriceInfo = await program.account.externalPriceAccount.fetch(priceAccount.publicKey);
		assert.equal(externalPriceInfo.pricePerShare.toString(), price.toString());
		assert.equal(externalPriceInfo.priceMint.toString(), redeemMint.publicKey.toString());
		assert.equal(externalPriceInfo.allowedToCombine, canCombine);
	}

	before(async () => {

		// Initialize the tokens we need
		lockedMint = await createMint(0); // NFT
		redeemMint = await createMint(9); // Token used to buy-out NFT (likely WSOL or USDC)
		storeMint = await createMint(9); // Fraction token

		[authorityPda, authorityPdaBump] = await anchor.web3.PublicKey.findProgramAddress(
			[Buffer.from("price"), priceAccount.publicKey.toBuffer(), program.programId.toBuffer()], 
			program.programId
		);

	})

	it('Initialize', async () => {

        userTokenAccount = await storeMint.createAccount(user);
		await storeMint.mintTo(userTokenAccount, user, [], 100 * 10**DECIMALS);
		await program.rpc.initialize(authorityPdaBump, minPrice, { 
			accounts: {
				priceAccount: priceAccount.publicKey,
				storeMint: storeMint.publicKey,
				redeemMint: redeemMint.publicKey,
				lockedMint: lockedMint.publicKey,
                store: storeTokenAccount.publicKey,
                storeAuthorityPda: authorityPda,
				signer: user,
				tokenProgram: TOKEN_PROGRAM_ID,
				systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
			},
			signers: [storeTokenAccount, priceAccount]
		});

    })

	it('Check initial tokenInfo state', async () => {
		let tokenInfo = await program.account.tokenInfo.fetch(authorityPda);
		assert.equal(tokenInfo.reserveTotal.toString(), '0');
		assert.equal(tokenInfo.totalVotes.toString(), '0');
		assert.equal(tokenInfo.minPrice.toString(), minPrice.toString());
		assert.equal(tokenInfo.mint.toString(), storeMint.publicKey.toString());
		assert.equal(tokenInfo.store.toString(), storeTokenAccount.publicKey.toString());
		assert.equal(tokenInfo.lockedMint.toString(), lockedMint.publicKey.toString());
		assert.equal(tokenInfo.authority.toString(), provider.wallet.publicKey.toString());
	});

	it('Check initial externalPriceInfo state', async () => {
		let externalPriceInfo = await program.account.externalPriceAccount.fetch(priceAccount.publicKey);
		assert.equal(externalPriceInfo.pricePerShare.toString(), '0');
		assert.equal(externalPriceInfo.priceMint.toString(), redeemMint.publicKey.toString());
		assert.equal(externalPriceInfo.allowedToCombine, false);
	});

	// The allowedToCombine flag should only change to true once more than 50% 
	// of the fraction tokens have been voted on. So exactly 50% votes shouldn't
	// trigger the flag.
	it('Add half votes', async () => {
		await addVotes(50, 10, userTokenAccount);
		await checkTokenInfo(50, 50 * 10, 10);
		await checkExternalPriceInfo(10, false);
		await checkUserInfo(50, 10);
	})

	// Now (51/100) > 50% so the allowedToCombine flag should be true
	it('Add one more vote', async () => {
		await addVotes(1, 10, userTokenAccount);
		await checkTokenInfo(51, 51 * 10, 10);
		await checkExternalPriceInfo(10, true);
		await checkUserInfo(51, 10);
	})

	// Now (50/100) = 50% so the allowedToCombine flag should be false 
	it('Remove one vote', async () => {
		await removeVotes(1, userTokenAccount);
		await checkTokenInfo(50, 50 * 10, 10);
		await checkExternalPriceInfo(10, false);
		await checkUserInfo(50, 10);
	})

	it('Add more vote again', async () => {
		await addVotes(1, 40, userTokenAccount);
		await checkTokenInfo(51, 51 * 40, 10);
		await checkExternalPriceInfo(40, true);
		await checkUserInfo(51, 40);
	})

	it('Check price cannot be set below minimum', async () => {
		try {
			await addVotes(1, 5, userTokenAccount);
			assert.ok(false);
		} catch (err) {
			assert.equal(err.message, "304: The price must be greater than the minimum set price");
		}
	});

	it('Check price cannot be set below 1/5th of the current price', async () => {
		await addVotes(1, 60, userTokenAccount);
		try {
			await addVotes(1, 10, userTokenAccount);
			assert.ok(false);
		} catch (err) {
			assert.equal(err.message, "305: The price must be greater than 1/5th the current weighted average");
		}
	});

	it('Check price cannot be set above 5 times the current price', async () => {
		try {
			await addVotes(1, 500, userTokenAccount);
			assert.ok(false);
		} catch (err) {
			assert.equal(err.message, "303: The price must be less than 5x the current weighted average");
		}
	});

	it('Check user cannot add more than the tokens they own', async () => {
		try {
			await addVotes(200, 30, userTokenAccount);
			assert.ok(false);
		} catch (err) {
			assert.equal(err.message, "300: User doesn't have enough tokens in their account");
		}
	});

	it('Check user cannot withdraw more than the tokens they own', async () => {
		try {
			await removeVotes(200, userTokenAccount);
			assert.ok(false);
		} catch (err) {
			assert.equal(err.message, "301: User is trying to remove more votes than they have");
		}
	});

	it('Adding 0 votes should just update price', async () => {
		await addVotes(0, 20, userTokenAccount);
		await checkTokenInfo(52, 52 * 20, 10);
		await checkExternalPriceInfo(20, true);
		await checkUserInfo(52, 20);
	});

	it('Set minimum price', async () => {
		await setMinPrice(5);
		await checkTokenInfo(52, 52 * 20, 5);
	});

	it('Check only authority can change minimum price', async () => {
		let badActor = anchor.web3.Keypair.generate();
		try {
			await setMinPrice(2, badActor);
			assert.ok(false);
		} catch (err) {
			assert.equal(err.toString(), "A has_one constraint was violated");
		}
	});

	it("Check storeMint constraint", async () => {

		let [userPda, userPdaBump] = await anchor.web3.PublicKey.findProgramAddress(
			[Buffer.from("user"), payer.publicKey.toBuffer(), priceAccount.publicKey.toBuffer(), program.programId.toBuffer()], 
			program.programId
		);
		try {
			await program.rpc.addVote(authorityPdaBump, userPdaBump, new BN(0), minPrice, {
				accounts: {
					userPda: userPda,
					priceAccount: priceAccount.publicKey,
					storeMint: redeemMint.publicKey,
					userTokenAccount: userTokenAccount,
					store: storeTokenAccount.publicKey,
					storeAuthorityPda: authorityPda,
					signer: payer.publicKey,
					tokenProgram: TOKEN_PROGRAM_ID,
					systemProgram: SystemProgram.programId,
					rent: SYSVAR_RENT_PUBKEY,
				},
				signers: [payer]
			});
			assert.ok(false);
		} catch (err) {
			assert.equal(err.toString(), "A raw constraint was violated");
		}
		
	})

	it("Check fromAccount's mint must be the storeMint", async () => {
		let wrongTokenAccount = await redeemMint.createAccount(user);

		let [userPda, userPdaBump] = await anchor.web3.PublicKey.findProgramAddress(
			[Buffer.from("user"), payer.publicKey.toBuffer(), priceAccount.publicKey.toBuffer(), program.programId.toBuffer()], 
			program.programId
		);

		try {
			await program.rpc.addVote(authorityPdaBump, userPdaBump, new BN(0), minPrice, {
				accounts: {
					userPda: userPda,
					priceAccount: priceAccount.publicKey,
					storeMint: storeMint.publicKey,
					userTokenAccount: wrongTokenAccount,
					store: storeTokenAccount.publicKey,
					storeAuthorityPda: authorityPda,
					signer: payer.publicKey,
					tokenProgram: TOKEN_PROGRAM_ID,
					systemProgram: SystemProgram.programId,
					rent: SYSVAR_RENT_PUBKEY,
				},
				signers: [payer]
			})
			assert.ok(false);
		} catch (err) {
			assert.equal(err.toString(), "A raw constraint was violated");
		}
		
	})

	it("Check fromAccount must belong to the signer", async () => {
		let badActor = anchor.web3.Keypair.generate();
		try {
			await addVotes(1, 10, userTokenAccount, badActor);
			assert.ok(false);
		} catch (err) {}
		
	})

	it("Check that user cannot remove 0 votes", async () => {
		try {
			await removeVotes(0, userTokenAccount);
			assert.ok(false);
		} catch (err) {
			assert.equal(err.message, "306: Cannot remove zero votes");
		}
	})

	it("Check price account can't be owned by another program", async () => {
		let badPriceAccount = Keypair.generate();
    	let transaction = new Transaction();
		let balanceNeeded = await splToken.Token.getMinBalanceRentForExemptAccount(connection);
		transaction.add(
			SystemProgram.createAccount({
				fromPubkey: payer.publicKey,
				newAccountPubkey: badPriceAccount.publicKey,
				lamports: balanceNeeded,
				space: splToken.AccountLayout.span,
				programId: splToken.TOKEN_PROGRAM_ID,
			})
		);
		await provider.send(transaction, [badPriceAccount]);

		let badActor = anchor.web3.Keypair.generate();
		let badTokenAccount = await storeMint.createAccount(badActor.publicKey);
		try {
			await addVotes(1, 10, badTokenAccount, badActor, badPriceAccount);
			assert.ok(false);
		} catch (err) {
			assert.equal(err.toString(), "The given account is not owned by the executing program");
		}

		try {
			await removeVotes(0, userTokenAccount, badActor, badPriceAccount);
			assert.ok(false);
		} catch (err) {
			assert.equal(err.toString(), "The given account is not owned by the executing program");
		}

	})

})