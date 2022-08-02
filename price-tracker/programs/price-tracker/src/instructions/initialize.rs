use anchor_lang::prelude::*;
use anchor_spl::token::{Token, Mint, TokenAccount};
use crate::state::{ExternalPriceAccount, TokenInfo};

#[derive(Accounts)]
#[instruction(pda_bump: u8)]
pub struct Initialize<'info> {

    #[account(init, payer = signer, space = 8 + 42)]
    pub price_account: Account<'info, ExternalPriceAccount>,

    #[account(init, payer = signer, token::mint = store_mint, token::authority = store_authority_pda)]
    pub store: Account<'info, TokenAccount>,

    #[account(
        init, 
        payer = signer, 
        space = 8 + 24 + 32 + 32 + 32 + 32, 
        seeds = [b"price".as_ref(), price_account.key().as_ref(), crate::id().as_ref()], 
        bump = pda_bump
    )]
    pub store_authority_pda: Account<'info, TokenInfo>,

    pub store_mint: Account<'info, Mint>,

    pub redeem_mint: Account<'info, Mint>,

    pub locked_mint: Account<'info, Mint>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    
    pub rent: Sysvar<'info, Rent>,

    pub system_program: Program<'info, System>,

}

pub fn handler(ctx: Context<Initialize>, min_price: u64) -> ProgramResult {
    let price_account = &mut ctx.accounts.price_account;
    let token_info = &mut ctx.accounts.store_authority_pda;
    token_info.min_price = min_price;
    token_info.store = ctx.accounts.store.key();
    token_info.mint = ctx.accounts.store_mint.key();
    token_info.locked_mint = ctx.accounts.locked_mint.key();
    token_info.authority = ctx.accounts.signer.key();
    price_account.price_mint = ctx.accounts.redeem_mint.key();
    Ok(())
}