use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, Token, Mint, TokenAccount};
use anchor_lang::solana_program;
use std::result::Result;

use crate::state::{Auction, Bid, Authority, Settings};
use crate::vault::{Vault, Price, create_combine_vault_instruction};
use crate::instructions::utils;

#[derive(Accounts)]
#[instruction(auction_bump: u8, bid_bump: u8)]
pub struct Start<'info> {

    // The program authority is the authority on the vault and as such
    // it is needed to sign the invocation to the vault program to combine it.
    #[account(
        mut,
        seeds = [b"authority".as_ref(), crate::id().as_ref()],
        bump = authority.bump
    )]
    pub authority: Account<'info, Authority>,

    // The auction authority 
    #[account(
        init, 
        payer = bidder,
        space = 8 + Auction::space(),
        seeds = [b"auction".as_ref(), vault.key().as_ref()],
        bump = auction_bump,
    )]
    pub auction: Box<Account<'info, Auction>>,

    pub settings: Box<Account<'info, Settings>>,

    #[account(
        init, 
        payer = bidder, 
        token::mint = payment_mint,
        token::authority = auction
    )]
    pub payment_treasury: Box<Account<'info, TokenAccount>>,

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

    #[account(
        mut,
        constraint = paying_token_account.mint == payment_mint.key(),
        constraint = paying_token_account.owner == bidder.key(),
    )]
    pub paying_token_account: Box<Account<'info, TokenAccount>>,
    
    #[account(mut)]
    pub bidder: Signer<'info>,

    // ------
    // Mints:
    // ------ 

    #[account(mut)]
    pub fraction_mint: Box<Account<'info, Mint>>,

    #[account(constraint = external_pricing_account.price_mint == payment_mint.key())]
    pub payment_mint: Box<Account<'info, Mint>>,

    // ------------------------------------------------------------
    // Additional accounts needed for the combine vault invocation:
    // ------------------------------------------------------------

    #[account(mut)]
    pub vault: Box<Account<'info, Vault>>,

    pub external_pricing_account: Box<Account<'info, Price>>,

    #[account(mut)]
    pub outstanding_fractions_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub vault_fraction_treasury: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub vault_redeem_treasury: Box<Account<'info, TokenAccount>>,

    pub vault_pda: AccountInfo<'info>,

    pub vault_program: AccountInfo<'info>,

    // --------------------------------------------------
    // For account initialisation and token invocations:
    // --------------------------------------------------

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
    
    pub rent: Sysvar<'info, Rent>,

}

impl<'info> Start<'info> {

    fn combine_vault(&mut self) -> Result<u64, ProgramError> {
        let balance_before = self.paying_token_account.amount;
        combine_vault(
            self.combine_context()
                .with_signer(&[&[b"authority".as_ref(), crate::id().as_ref(), &[self.authority.bump]]])
        )?;
        self.paying_token_account.reload()?;
        let balance_after = self.paying_token_account.amount;
        Ok(balance_before - balance_after)
    }

    fn combine_context(&self) -> CpiContext<'_, '_, '_, 'info, Combine<'info>> {
        CpiContext::new(
            self.vault_program.clone(),
            Combine {
                vault: self.vault.to_account_info(),
                vault_authority: self.authority.to_account_info(),
                vault_pda: self.vault_pda.to_account_info(),
                external_pricing_account: self.external_pricing_account.to_account_info(),
                outstanding_share_token_account: self.outstanding_fractions_token_account.to_account_info(),
                paying_token_account: self.paying_token_account.to_account_info(),
                fraction_mint: self.fraction_mint.to_account_info(),
                fraction_treasury: self.vault_fraction_treasury.to_account_info(),
                redeem_treasury: self.vault_redeem_treasury.to_account_info(),
                payer: self.bidder.to_account_info(),
                token_program: self.token_program.to_account_info(),
            }
        )
    }

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
}

#[derive(Accounts)]
struct Combine<'info> {
    pub vault: AccountInfo<'info>,
    pub vault_authority: AccountInfo<'info>,
    pub vault_pda: AccountInfo<'info>,
    pub external_pricing_account: AccountInfo<'info>,
    pub outstanding_share_token_account: AccountInfo<'info>,
    pub paying_token_account: AccountInfo<'info>,
    pub fraction_mint: AccountInfo<'info>,
    pub fraction_treasury: AccountInfo<'info>,
    pub redeem_treasury: AccountInfo<'info>,
    pub payer: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>
}


fn combine_vault<'a, 'b, 'c, 'info>(ctx: CpiContext<'a, 'b, 'c, 'info, Combine<'info>>) -> ProgramResult {
    let ix = create_combine_vault_instruction(
        Vault::owner(),
        *ctx.accounts.vault.key,
        *ctx.accounts.outstanding_share_token_account.key,
        *ctx.accounts.paying_token_account.key,
        *ctx.accounts.fraction_mint.key,
        *ctx.accounts.fraction_treasury.key,
        *ctx.accounts.redeem_treasury.key,
        *ctx.accounts.vault_authority.key,
        *ctx.accounts.vault_authority.key,
        *ctx.accounts.payer.key,
        *ctx.accounts.vault_pda.key,
        *ctx.accounts.external_pricing_account.key,
    );
    solana_program::program::invoke_signed(
        &ix,
        &[
            ctx.accounts.vault.clone(),
            ctx.accounts.outstanding_share_token_account.clone(),
            ctx.accounts.paying_token_account.clone(),
            ctx.accounts.fraction_mint.clone(),
            ctx.accounts.fraction_treasury.clone(),
            ctx.accounts.redeem_treasury.clone(),
            ctx.accounts.vault_authority.clone(),
            ctx.accounts.vault_authority.clone(),
            ctx.accounts.payer.clone(),
            ctx.accounts.vault_pda.clone(),
            ctx.accounts.external_pricing_account.clone(),
            ctx.accounts.token_program.clone(),
            ctx.program.clone(),
        ],
        ctx.signer_seeds
    )
}


pub fn handler(ctx: Context<Start>, auction_bump: u8, bid_bump: u8, bid_amount: u64) -> ProgramResult {
    let vault = &ctx.accounts.vault;
    let external_pricing_account = &ctx.accounts.external_pricing_account;
    let authority = &ctx.accounts.authority;
    let paying_token_account = &ctx.accounts.paying_token_account;

    // Check the vault information is correct and ready to combine
    utils::assert_sufficient_funds(paying_token_account, bid_amount)?;
    utils::assert_vault_owned_by_auction_program_authority(vault, authority)?;
    utils::assert_correct_pricing_account(vault, external_pricing_account)?;
    utils::assert_vault_allowed_to_combine(external_pricing_account)?;
    utils::assert_vault_in_active_state(vault)?;

    // Combine the vault!
    let reserve_price = ctx.accounts.combine_vault()?;
    msg!("reserve-price: {}", reserve_price);

    let settings = &ctx.accounts.settings;
    let minimum_bid = utils::calculate_minimum_starting_bid(reserve_price, settings.facilitator_fee)?;
    msg!("minimum-bid: {}", minimum_bid);

    utils::assert_bid_meets_reserve_price(bid_amount, minimum_bid)?;

    // Transfer the remaining bid amount to the payment treasury
    ctx.accounts.transfer_to_treasury(bid_amount - reserve_price)?;

    let bid = &mut ctx.accounts.bid;
    let auction = &mut ctx.accounts.auction;
    let current_timestamp = utils::get_current_timestamp()?;

    // Set the bid information
    bid.bidder = ctx.accounts.bidder.key();
    bid.auction = auction.key();
    bid.amount = bid_amount;
    bid.timestamp = current_timestamp;
    bid.withdrawable = false;
    bid.token_account = ctx.accounts.bid_token_account.key();
    bid.bump = bid_bump;

    // Set the auction information
    auction.start_timestamp = current_timestamp;
    auction.end_timestamp = current_timestamp + settings.duration;
    auction.payment_mint = ctx.accounts.payment_mint.key();
    auction.top_bid = bid_amount;
    auction.top_bidder = ctx.accounts.bidder.key();
    auction.reserve_price = reserve_price;
    auction.settings = settings.key();
    auction.vault = ctx.accounts.vault.key();
    auction.payment_treasury = ctx.accounts.payment_treasury.key();
    auction.bump = auction_bump;

    solana_program::log::sol_log_compute_units();

    Ok(())
}