use anchor_lang::prelude::*;
use anchor_spl::token::{Token, Mint, TokenAccount};
use anchor_lang::solana_program;

use crate::state::{Auction, Authority, Settings};
use crate::vault::{Vault, create_withdraw_tokens_instruction};
use crate::instructions::utils;

#[derive(Accounts)]
pub struct Claim<'info> {

    #[account(
        mut,
        seeds = [b"authority".as_ref(), crate::id().as_ref()],
        bump = authority.bump
    )]
    pub authority: Box<Account<'info, Authority>>,

    #[account(
        mut,
        seeds = [b"auction".as_ref(), vault.key().as_ref()],
        bump = auction.bump,
        has_one = settings
    )]
    pub auction: Box<Account<'info, Auction>>,

    pub settings: Box<Account<'info, Settings>>,

    #[account(mut)]
    pub vault: Box<Account<'info, Vault>>,

    #[account(mut)]
    pub destination_token_account: Box<Account<'info, TokenAccount>>,

    pub bidder: Signer<'info>,

    // ------------------------------------------------------------------
    // Additional accounts needed for the withdraw from vault invocation:
    // ------------------------------------------------------------------

    pub token_program: Program<'info, Token>,

    #[account(mut)]
    pub locked_token_account: AccountInfo<'info>,

    #[account(mut)]
    pub safety_deposit_box: AccountInfo<'info>,

    pub vault_pda: AccountInfo<'info>,

    pub vault_program: AccountInfo<'info>,

    #[account(mut)]
    pub fraction_mint: Box<Account<'info, Mint>>,

    pub rent: Sysvar<'info, Rent>,

}

impl<'info> Claim<'info> {

    fn withdraw_context(&self) -> CpiContext<'_, '_, '_, 'info, Withdraw<'info>> {
        CpiContext::new(
            self.vault_program.clone(),
            Withdraw {
                vault: self.vault.to_account_info(),
                vault_authority: self.authority.to_account_info(),
                vault_pda: self.vault_pda.to_account_info(),
                destination_token_account: self.destination_token_account.to_account_info(),
                safety_deposit_box: self.safety_deposit_box.to_account_info(),
                locked_token_account: self.locked_token_account.to_account_info(),
                fraction_mint: self.fraction_mint.to_account_info(),
                rent: self.rent.to_account_info(),
                token_program: self.token_program.to_account_info(),
            }
        )
    }

}

#[derive(Accounts)]
struct Withdraw<'info> {
    pub vault: AccountInfo<'info>,
    pub vault_authority: AccountInfo<'info>,
    pub vault_pda: AccountInfo<'info>,
    pub destination_token_account: AccountInfo<'info>,
    pub safety_deposit_box: AccountInfo<'info>,
    pub locked_token_account: AccountInfo<'info>,
    pub fraction_mint: AccountInfo<'info>,
    pub rent: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>
}


fn withdraw_locked<'a, 'b, 'c, 'info>(ctx: CpiContext<'a, 'b, 'c, 'info, Withdraw<'info>>, amount: u64) -> ProgramResult {
    let ix = create_withdraw_tokens_instruction(
        Vault::owner(),
        *ctx.accounts.destination_token_account.key,
        *ctx.accounts.safety_deposit_box.key,
        *ctx.accounts.locked_token_account.key,
        *ctx.accounts.vault.key,
        *ctx.accounts.fraction_mint.key,
        *ctx.accounts.vault_authority.key,
        *ctx.accounts.vault_pda.key,
        amount,
    );
    solana_program::program::invoke_signed(
        &ix,
        &[
            ctx.accounts.destination_token_account.to_account_info(),
            ctx.accounts.safety_deposit_box.to_account_info(),
            ctx.accounts.locked_token_account.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.fraction_mint.to_account_info(),
            ctx.accounts.vault_authority.to_account_info(),
            ctx.accounts.vault_pda.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
            ctx.program.to_account_info(),
        ],
        ctx.signer_seeds
    )

}

pub fn handler(ctx: Context<Claim>, amount: u64) -> ProgramResult {
    let auction = &ctx.accounts.auction;
    let authority = &ctx.accounts.authority;

    // Make sure the auction has in actually ended
    utils::assert_auction_has_ended(auction)?;

    // Make sure the claimer is indeed the auction winner
    utils::assert_auction_winner(&ctx.accounts.bidder.key(), &auction.top_bidder)?;

    withdraw_locked(
        ctx.accounts
            .withdraw_context()
            .with_signer(&[&[b"authority".as_ref(), crate::id().as_ref(), &[authority.bump]]]),
        amount
    )?;

    Ok(())
}