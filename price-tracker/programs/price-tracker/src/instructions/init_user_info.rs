use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::state::{UserInfo, ExternalPriceAccount};


#[derive(Accounts)]
#[instruction(user_bump: u8)]
pub struct InitUserInfo<'info> {

    #[account(owner = crate::id())]
    pub price_account: Account<'info, ExternalPriceAccount>,

    #[account(init, payer = signer, space = 8 + 16, seeds = [b"user".as_ref(), signer.key().as_ref(), price_account.key().as_ref(), crate::id().as_ref()], bump = user_bump)]
    pub user_pda: Account<'info, UserInfo>,

    pub store_mint: Account<'info, Mint>,

    pub signer: Signer<'info>,

    pub rent: Sysvar<'info, Rent>,

    pub system_program: Program<'info, System>,

}