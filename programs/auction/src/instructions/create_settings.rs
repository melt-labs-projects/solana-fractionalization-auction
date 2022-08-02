use anchor_lang::prelude::*;

use crate::errors::*;
use crate::state::{Authority, Settings, MAX_FACILITATOR_FEE};

#[derive(Accounts)]
pub struct CreateSettings<'info> {

    #[account(
        mut,
        seeds = [b"authority".as_ref(), crate::id().as_ref()],
        bump = authority.bump,
        has_one = owner
    )]
    pub authority: Account<'info, Authority>,

    #[account(
        init,
        payer = owner,
        space = 8 + Settings::space()
    )]
    pub settings: Account<'info, Settings>,

    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
    
    pub rent: Sysvar<'info, Rent>,

}


pub fn handler(
    ctx: Context<CreateSettings>,
    duration: u64,
    soft_close_period: u64,
    bid_increment: u64,
    facilitator_fee: u64
) -> ProgramResult {

    if facilitator_fee > MAX_FACILITATOR_FEE {
        return Err(AuctionError::InvalidFacilitatorFee.into());
    }

    let settings = &mut ctx.accounts.settings;
    settings.duration = duration;
    settings.soft_close_period = soft_close_period;
    settings.bid_increment = bid_increment;
    settings.facilitator_fee = facilitator_fee;

    Ok(())
}