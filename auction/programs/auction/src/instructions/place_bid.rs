use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, Token, Mint, TokenAccount};

use crate::state::{Auction, Bid, Settings};
use crate::vault::Vault;
use crate::instructions::utils;

#[derive(Accounts)]
#[instruction(bid_bump: u8)]
pub struct PlaceBid<'info> {

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
        seeds = [b"bid".as_ref(), auction.top_bidder.as_ref(), auction.key().as_ref()],
        bump = top_bid.bump,
        constraint = top_bid.token_account == top_bid_token_account.key()
    )]
    pub top_bid: Box<Account<'info, Bid>>,

    #[account(mut)]
    pub top_bid_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init, 
        payer = bidder, 
        space = 8 + Bid::space(),
        seeds = [b"bid".as_ref(), bidder.key().as_ref(), auction.key().as_ref()],
        bump = bid_bump,
    )]
    pub bid: Box<Account<'info, Bid>>,

    #[account(
        init, 
        payer = bidder, 
        token::mint = payment_mint,
        token::authority = bid
    )]
    pub bid_token_account: Box<Account<'info, TokenAccount>>,

    #[account(constraint = auction.payment_mint == payment_mint.key())]
    pub payment_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = paying_token_account.mint == payment_mint.key(),
        constraint = paying_token_account.owner == bidder.key(),
    )]
    pub paying_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub bidder: Signer<'info>,

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
    
    pub rent: Sysvar<'info, Rent>,

}

impl<'info> PlaceBid<'info> {

    fn transfer_to_treasury(&self, amount: u64) -> ProgramResult {
        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(), 
                Transfer {
                    from: self.paying_token_account.to_account_info(),
                    to: self.payment_treasury.to_account_info(),
                    authority: self.bidder.to_account_info()
                }
            ), 
            amount
        )?;
        Ok(())
    }

    fn transfer_back_to_top_bidder(&self) -> ProgramResult {
        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(), 
                Transfer {
                    from: self.payment_treasury.to_account_info(),
                    to: self.top_bid_token_account.to_account_info(),
                    authority: self.auction.to_account_info()
                },
                &[&[b"auction".as_ref(), self.vault.key().as_ref(), &[self.auction.bump]]]
            ), 
            self.top_bid.amount
        )?;
        Ok(())
    }

}

pub fn handler(ctx: Context<PlaceBid>, bid_bump: u8, bid_amount: u64) -> ProgramResult {
    let auction = &ctx.accounts.auction;
    let settings = &ctx.accounts.settings;
    let paying_token_account = &ctx.accounts.paying_token_account;

    utils::assert_sufficient_funds(paying_token_account, bid_amount)?;
    utils::assert_auction_has_not_ended(auction)?;
    utils::assert_sufficient_bid(bid_amount, auction.top_bid, settings.bid_increment)?;

    // Transfer payment from bidder
    ctx.accounts.transfer_to_treasury(bid_amount)?;

    let current_timestamp = utils::get_current_timestamp()?;
    let bid = &mut ctx.accounts.bid;
    bid.bidder = ctx.accounts.bidder.key();
    bid.auction = auction.key();
    bid.amount = bid_amount;
    bid.timestamp = current_timestamp;
    bid.withdrawable = false;
    bid.token_account = ctx.accounts.bid_token_account.key();
    bid.bump = bid_bump;

    // Transfer back the old bid
    ctx.accounts.transfer_back_to_top_bidder()?;

    let top_bid = &mut ctx.accounts.top_bid;
    let auction = &mut ctx.accounts.auction;

    top_bid.withdrawable = true;
    auction.top_bid = bid_amount;
    auction.top_bidder = ctx.accounts.bidder.key();

    // Extend the auction if needed
    let time_remaining = auction.end_timestamp - current_timestamp;
    if time_remaining < settings.soft_close_period {
        auction.end_timestamp = current_timestamp + settings.soft_close_period;
    }
    
    Ok(())
}