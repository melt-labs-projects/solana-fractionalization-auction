use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, Token, Mint, TokenAccount};
use crate::state::{ExternalPriceAccount, TokenInfo, UserInfo};
use crate::errors::ErrorCode;


#[derive(Accounts)]
#[instruction(pda_bump: u8, user_bump: u8)]
pub struct RemoveVotes<'info> {

    #[account(
        mut, 
        owner = crate::id()
    )]
    pub price_account: Account<'info, ExternalPriceAccount>,

    #[account(
        mut, 
        constraint = store.mint == store_mint.key(),
        constraint = store.owner == store_authority_pda.key(), 
        owner = token::ID
    )]
    pub store: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_account.owner == signer.key(),
        constraint = user_token_account.mint == store_mint.key(),
        owner = token::ID
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut, 
        seeds = [b"user".as_ref(), signer.key().as_ref(), price_account.key().as_ref(), crate::id().as_ref()], 
        bump = user_bump,
        owner = crate::id()
    )]
    pub user_pda: Account<'info, UserInfo>,

    #[account(
        mut, 
        seeds = [b"price".as_ref(), price_account.key().as_ref(), crate::id().as_ref()], 
        bump = pda_bump,
        owner = crate::id()
    )]
    pub store_authority_pda: Account<'info, TokenInfo>,

    pub store_mint: Account<'info, Mint>,

    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,

}


pub fn handler(ctx: Context<RemoveVotes>, pda_bump: u8, votes: u64) -> ProgramResult {
    if votes == 0 {
        return Err(ErrorCode::AmountIsZero.into());
    }

    // Writable accounts
    let token_info = &mut ctx.accounts.store_authority_pda;
    let user_info = &mut ctx.accounts.user_pda;
    let price_account = &mut ctx.accounts.price_account;
    
    // Readable accounts
    let user_token_account = &ctx.accounts.user_token_account;
    let store_mint = &ctx.accounts.store_mint;

    if user_info.votes < votes {
        return Err(ErrorCode::NotEnoughVotesToRemove.into());
    }

    user_info.votes -= votes;
    token_info.total_votes -= votes;

    token_info.reserve_total -= match (votes as u128).checked_mul(user_info.price as u128) {
        Some(val) => match (val).checked_div(1e9 as u128) {
            Some(val) => val as u64,
            None => return Err(ErrorCode::NumericalOverflowError.into()),
        },
        None => return Err(ErrorCode::NumericalOverflowError.into()),
    };
    
    let half_supply = match store_mint.supply.checked_div(2) {
        Some(val) => val,
        None => return Err(ErrorCode::NumericalOverflowError.into()),
    };

    if token_info.total_votes <= half_supply {
        price_account.allowed_to_combine = false;
    }

    if token_info.total_votes > 0 {
        price_account.price_per_share = match (token_info.reserve_total as u128).checked_mul(1e9 as u128) {
            Some(val) => match val.checked_div(token_info.total_votes as u128) {
                Some(val) => std::cmp::max(token_info.min_price, val as u64),
                None => return Err(ErrorCode::NumericalOverflowError.into()),
            },
            None => return Err(ErrorCode::NumericalOverflowError.into()),
        };
    } else {
        price_account.price_per_share = token_info.min_price;
    }
    

    // transfer tokens from store to user_token_account
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(), 
            Transfer {
                from: ctx.accounts.store.to_account_info(),
                to: user_token_account.to_account_info(),
                authority: ctx.accounts.store_authority_pda.to_account_info()
            },
            &[&[b"price".as_ref(), price_account.key().as_ref(), ctx.program_id.as_ref(), &[pda_bump]]]
        ), 
        votes
    )?;

    Ok(())
}