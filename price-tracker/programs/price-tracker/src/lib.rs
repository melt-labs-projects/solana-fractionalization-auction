use anchor_lang::prelude::*;

pub mod errors;
pub mod state;
pub mod instructions;

use instructions::*;

declare_id!("D8K3mcxvwDE7ykDPhL6xGXfkWXhbB1YS2nH3MCS1WmsD");

#[program]
pub mod price_tracker {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, pda_bump: u8, min_price: u64) -> ProgramResult {
        instructions::initialize::handler(ctx, min_price)
    }

    pub fn init_user_info(ctx: Context<InitUserInfo>, user_bump: u8) -> ProgramResult {
        Ok(())
    }

    pub fn set_min_price(ctx: Context<SetMinPrice>, pda_bump: u8, min_price: u64) -> ProgramResult {
        instructions::set_min_price::handler(ctx, min_price)
    }

    pub fn add_vote(ctx: Context<AddVotes>, pda_bump: u8, user_bump: u8, votes: u64, price: u64) -> ProgramResult {
        instructions::add_votes::handler(ctx, votes, price)
    }

    pub fn remove_vote(ctx: Context<RemoveVotes>, pda_bump: u8, user_bump: u8, votes: u64) -> ProgramResult {
        instructions::remove_votes::handler(ctx, pda_bump, votes)
    }
}
