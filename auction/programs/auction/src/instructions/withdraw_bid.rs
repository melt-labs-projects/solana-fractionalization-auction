use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, Token, TokenAccount, CloseAccount};

use crate::state::{Auction, Bid, Settings};
use crate::vault::Vault;
use crate::instructions::utils;

#[derive(Accounts)]
pub struct WithdrawBid<'info> {

    #[account(
        seeds = [b"auction".as_ref(), vault.key().as_ref()],
        bump = auction.bump,
        has_one = settings
    )]
    pub auction: Box<Account<'info, Auction>>,

    pub settings: Box<Account<'info, Settings>>,

    pub vault: Box<Account<'info, Vault>>,

    #[account(
        mut,
        seeds = [b"bid".as_ref(), bidder.key().as_ref(), auction.key().as_ref()],
        bump = bid.bump,
        constraint = bid.token_account == bid_token_account.key(),
        has_one = bidder,
        close = bidder
    )]
    pub bid: Box<Account<'info, Bid>>,

    #[account(mut)]
    pub bid_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = to_account.mint == auction.payment_mint
    )]
    pub to_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub bidder: Signer<'info>,

    pub token_program: Program<'info, Token>

}

impl<'info> WithdrawBid<'info> {

    fn return_funds_to_bidder(&self) -> ProgramResult {
        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(), 
                Transfer {
                    from: self.bid_token_account.to_account_info(),
                    to: self.to_account.to_account_info(),
                    authority: self.bid.to_account_info()
                },
                &[&[b"bid".as_ref(), self.bidder.key().as_ref(), self.auction.key().as_ref(), &[self.bid.bump]]]
            ), 
            self.bid_token_account.amount
        )?;
        Ok(())
    }

    fn close_bid_account(&self) -> ProgramResult {
        token::close_account(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                CloseAccount {
                    account: self.bid_token_account.to_account_info(),
                    destination: self.bidder.to_account_info(),
                    authority: self.bid.to_account_info()
                },
                &[&[b"bid".as_ref(), self.bidder.key().as_ref(), self.auction.key().as_ref(), &[self.bid.bump]]]
            )
        )?;
        Ok(())
    }

}

pub fn handler(ctx: Context<WithdrawBid>) -> ProgramResult {
    let auction = &ctx.accounts.auction;
    let bid = &ctx.accounts.bid;

    // Make sure the top bider cannot withdraw their bid
    utils::assert_not_top_bidder(&bid.bidder, &auction.top_bidder)?;

    // Transfer all the funds from their bidding token account to the token account
    // they specify, which does not necessarily have to be owned by them.
    ctx.accounts.return_funds_to_bidder()?;

    // Close their bidding account and return the rent to the bidder.
    ctx.accounts.close_bid_account()?;

    Ok(())
}