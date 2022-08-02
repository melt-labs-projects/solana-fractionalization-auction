use anchor_lang::prelude::*;

use crate::state::{Authority};

#[derive(Accounts)]
#[instruction(authority_bump: u8)]
pub struct Init<'info> {

    #[account(
        init,
        payer = signer,
        space = 8 + Authority::space(),
        seeds = [b"authority".as_ref(), crate::id().as_ref()],
        bump = authority_bump
    )]
    pub authority: Account<'info, Authority>,

    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,
    
    pub rent: Sysvar<'info, Rent>,

}

pub fn handler(ctx: Context<Init>, authority_bump: u8) -> ProgramResult {
    let authority = &mut ctx.accounts.authority;
    authority.owner = ctx.accounts.signer.key();
    authority.bump = authority_bump;
    Ok(())
}