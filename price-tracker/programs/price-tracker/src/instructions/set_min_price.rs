use anchor_lang::prelude::*;
use anchor_spl::token::{Token, Mint, TokenAccount};
use crate::state::{ExternalPriceAccount, TokenInfo};

#[derive(Accounts)]
#[instruction(pda_bump: u8)]
pub struct SetMinPrice<'info> {

    pub price_account: Account<'info, ExternalPriceAccount>,

    #[account(
        mut,
        seeds = [b"price".as_ref(), price_account.key().as_ref(), crate::id().as_ref()], 
        bump = pda_bump,
        has_one = authority
    )]
    pub store_authority_pda: Account<'info, TokenInfo>,

    #[account(mut)]
    pub authority: Signer<'info>

}

pub fn handler(ctx: Context<SetMinPrice>, min_price: u64) -> ProgramResult {
    let token_info = &mut ctx.accounts.store_authority_pda;
    token_info.min_price = min_price;
    Ok(())
}