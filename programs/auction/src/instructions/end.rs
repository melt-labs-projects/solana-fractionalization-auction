use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, Token, TokenAccount};

use crate::state::{Auction, Settings, Authority};
use crate::vault::Vault;
use crate::instructions::utils;

#[derive(Accounts)]
pub struct End<'info> {

    #[account(
        mut,
        seeds = [b"authority".as_ref(), crate::id().as_ref()],
        bump = authority.bump
    )]
    pub authority: ProgramAccount<'info, Authority>,

    #[account(
        mut,
        seeds = [b"auction".as_ref(), vault.key().as_ref()],
        bump = auction.bump,
        has_one = payment_treasury,
        has_one = settings
    )]
    pub auction: Box<Account<'info, Auction>>,

    pub settings: Box<Account<'info, Settings>>,

    pub vault: Box<Account<'info, Vault>>,

    #[account(mut)]
    pub payment_treasury: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = fee_token_account.mint == auction.payment_mint,
        constraint = fee_token_account.owner == authority.owner,
    )]
    pub fee_token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,

}

impl<'info> End<'info> {
    
    fn transfer_fee_to_owner(&self, fee: u64) -> ProgramResult {
        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(), 
                Transfer {
                    from: self.payment_treasury.to_account_info(),
                    to: self.fee_token_account.to_account_info(),
                    authority: self.auction.to_account_info()
                },
                &[&[b"auction".as_ref(), self.vault.key().as_ref(), &[self.auction.bump]]]
            ), 
            fee
        )?;
        Ok(())
    }

}

pub fn handler(ctx: Context<End>) -> ProgramResult {
    let auction = &ctx.accounts.auction;
    let settings = &ctx.accounts.settings;

    // Make sure this instruction cannot be called multiple times
    utils::assert_fee_not_delivered(auction)?;
    utils::assert_auction_has_ended(auction)?; 

    let fee = utils::calculate_fee(auction.top_bid, settings.facilitator_fee)?;
    ctx.accounts.transfer_fee_to_owner(fee)?;

    let auction = &mut ctx.accounts.auction;
    auction.fee_paid = true;

    Ok(())
}