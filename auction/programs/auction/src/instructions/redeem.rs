use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer, Mint, TokenAccount, CloseAccount};
use anchor_lang::solana_program;

use crate::state::{Auction, Settings};
use crate::vault::{Vault, create_redeem_shares_instruction};
use crate::instructions::utils;

#[derive(Accounts)]
pub struct Redeem<'info> {

    #[account(
        mut,
        seeds = [b"auction".as_ref(), vault.key().as_ref()],
        bump = auction.bump,
        has_one = payment_treasury,
        has_one = settings
    )]
    pub auction: Box<Account<'info, Auction>>,

    pub settings: Box<Account<'info, Settings>>,

    #[account(
        has_one = fraction_mint,
        has_one = redeem_treasury,
    )]
    pub vault: Box<Account<'info, Vault>>,

    #[account(mut)]
    pub payment_treasury: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub redeem_treasury: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = source_token_account.mint == fraction_mint.key()
    )]
    pub source_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = destination_token_account.mint == payment_treasury.mint
    )]
    pub destination_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub fraction_mint: Box<Account<'info, Mint>>,

    pub vault_pda: AccountInfo<'info>,

    pub vault_program: AccountInfo<'info>,

    pub redeemer: Signer<'info>,

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
    
    pub rent: Sysvar<'info, Rent>,

}

impl<'info> Redeem<'info> {

    fn redeem_context(&self) -> CpiContext<'_, '_, '_, 'info, RedeemShares<'info>> {
        CpiContext::new(
            self.vault_program.clone(),
            RedeemShares {
                vault: self.vault.to_account_info(),
                vault_pda: self.vault_pda.to_account_info(),
                src_account: self.source_token_account.to_account_info(),
                dest_account: self.destination_token_account.to_account_info(),
                fraction_mint: self.fraction_mint.to_account_info(),
                redeem_treasury: self.redeem_treasury.to_account_info(),
                redeemer: self.redeemer.to_account_info(),
                rent: self.rent.to_account_info(),
                token_program: self.token_program.to_account_info(),
            }
        )
    }

    fn transfer_to_redeemer(&self, amount: u64) -> ProgramResult {
        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(), 
                Transfer {
                    from: self.payment_treasury.to_account_info(),
                    to: self.destination_token_account.to_account_info(),
                    authority: self.auction.to_account_info()
                },
                &[&[b"auction".as_ref(), self.vault.key().as_ref(), &[self.auction.bump]]]
            ), 
            amount
        )?;
        Ok(())
    }

    fn close_payment_treasury(&self) -> ProgramResult {
        token::close_account(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                CloseAccount {
                    account: self.payment_treasury.to_account_info(),
                    destination: self.redeemer.to_account_info(),
                    authority: self.auction.to_account_info()
                },
                &[&[b"auction".as_ref(), self.vault.key().as_ref(), &[self.auction.bump]]]
            )
        )?;
        Ok(())
    }

}

#[derive(Accounts)]
struct RedeemShares<'info> {
    pub vault: AccountInfo<'info>,
    pub vault_pda: AccountInfo<'info>,
    pub src_account: AccountInfo<'info>,
    pub dest_account: AccountInfo<'info>,
    pub fraction_mint: AccountInfo<'info>,
    pub redeem_treasury: AccountInfo<'info>,
    pub redeemer: AccountInfo<'info>,
    pub rent: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>
}

fn redeem_shares<'a, 'b, 'c, 'info>(ctx: CpiContext<'a, 'b, 'c, 'info, RedeemShares<'info>>) -> ProgramResult {
    let ix = create_redeem_shares_instruction(
        Vault::owner(),
        *ctx.accounts.src_account.key,
        *ctx.accounts.dest_account.key,
        *ctx.accounts.fraction_mint.key,
        *ctx.accounts.redeem_treasury.key,
        *ctx.accounts.vault_pda.key,
        *ctx.accounts.redeemer.key,
        *ctx.accounts.vault.key
    );
    solana_program::program::invoke(
        &ix,
        &[
            ctx.accounts.src_account.clone(),
            ctx.accounts.dest_account.clone(),
            ctx.accounts.fraction_mint.clone(),
            ctx.accounts.redeem_treasury.clone(),
            ctx.accounts.vault_pda.clone(),
            ctx.accounts.redeemer.clone(),
            ctx.accounts.vault.clone(),
            ctx.accounts.token_program.clone(),
            ctx.accounts.rent.clone(),
            ctx.program.clone(),
        ]
    )

}

pub fn handler(ctx: Context<Redeem>) -> ProgramResult {

    utils::assert_auction_has_ended(&ctx.accounts.auction)?;
    utils::assert_fee_delivered(&ctx.accounts.auction)?;

    redeem_shares(ctx.accounts.redeem_context())?;

    let payment = utils::calculate_redeem_payment(
        ctx.accounts.payment_treasury.amount, 
        ctx.accounts.source_token_account.amount, 
        ctx.accounts.fraction_mint.supply
    )?;
    ctx.accounts.transfer_to_redeemer(payment)?;

    ctx.accounts.payment_treasury.reload()?;
    if ctx.accounts.payment_treasury.amount == 0 {
        ctx.accounts.close_payment_treasury()?;
    }

    Ok(())
}