use anchor_lang::prelude::*;

use crate::state::{Authority};

#[derive(Accounts)]
pub struct SetAuthority<'info> {

    #[account(
        mut,
        seeds = [b"authority".as_ref(), crate::id().as_ref()],
        bump = authority.bump,
        has_one = owner
    )]
    pub authority: Account<'info, Authority>,

    pub owner: Signer<'info>

}


pub fn handler(
    ctx: Context<SetAuthority>,
    new_owner: Pubkey
) -> ProgramResult {
    let authority = &mut ctx.accounts.authority;
    authority.owner = new_owner;
    Ok(())
}