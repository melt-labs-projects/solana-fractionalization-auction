use anchor_lang::prelude::*;

pub mod errors;
pub mod state;
pub mod instructions;
pub mod vault;

use instructions::*;

declare_id!("4h3i7ER3q3pE5LSAedStJaYUcCKd3oXWBKPf3iUWsgGS");

#[program]
pub mod auction {
    use super::*;

    pub fn init(ctx: Context<Init>, authority_bump: u8) -> ProgramResult {
        instructions::init::handler(ctx, authority_bump)
    }

    pub fn set_owner(ctx: Context<SetAuthority>, new_owner: Pubkey) -> ProgramResult {
        instructions::set_owner::handler(ctx, new_owner)
    }

    pub fn create_settings(
        ctx: Context<CreateSettings>,
        duration: u64,
        soft_close_period: u64,
        bid_increment: u64,
        facilitator_fee: u64
    ) -> ProgramResult {
        instructions::create_settings::handler(ctx, duration, soft_close_period, bid_increment, facilitator_fee)
    }

    // Start a new auction for a token vault which contains some asset such as an NFT.
    // This program needs to check that the vault is allowed to combine and that the person
    // starting the auction has bid a sufficient amount.
    pub fn start(
        ctx: Context<Start>,
        auction_bump: u8,
        bid_bump: u8,
        bid_amount: u64
    ) -> ProgramResult {
        instructions::start::handler(ctx, auction_bump, bid_bump, bid_amount)
    }

    // Place a bid for the contents of the token vault. 
    // Of course, the bid must be higher than the previous by a set amount.
    pub fn place_bid(ctx: Context<PlaceBid>, bid_bump: u8, bid_amount: u64) -> ProgramResult {
        instructions::place_bid::handler(ctx, bid_bump, bid_amount)
    }

    // Withdraw your bid if you have now been outbid.
    pub fn withdraw_bid(ctx: Context<WithdrawBid>) -> ProgramResult {
        instructions::withdraw_bid::handler(ctx)
    }

    // Officially end the auction, paying the owner the facilitator fee
    // and allowing redemptions to begin.
    pub fn end(ctx: Context<End>) -> ProgramResult {
        instructions::end::handler(ctx)
    }
    
    // Claim the contents of the auctioned token vault. 
    // Naturally, the caller needs to be the winner of the auction.
    pub fn claim(ctx: Context<Claim>, amount: u64) -> ProgramResult {
        instructions::claim::handler(ctx, amount)
    }

    // An endpoint where fractions holders can send their fractions in exchange 
    // for their share of the executed auction price.
    pub fn redeem(ctx: Context<Redeem>) -> ProgramResult {
        instructions::redeem::handler(ctx)
    }

}

