use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, Token, Mint, TokenAccount};
use crate::state::{ExternalPriceAccount, TokenInfo, UserInfo};
use crate::errors::ErrorCode;

#[derive(Accounts)]
#[instruction(pda_bump: u8, user_bump: u8)]
pub struct AddVotes<'info> {

    // owner must be this program
    #[account(mut, owner = crate::id())]
    pub price_account: ProgramAccount<'info, ExternalPriceAccount>,

    // authority must be pda
    // mint must be store_mint
    #[account(
        mut, 
        constraint = store.mint == store_mint.key(),
        constraint = store.owner == store_authority_pda.key(), 
        owner = token::ID
    )]
    pub store: Account<'info, TokenAccount>,

    // authority must be signer
    // mint must be store mint
    #[account(
        mut,
        constraint = user_token_account.owner == signer.key(),
        constraint = user_token_account.mint == store_mint.key(),
        owner = token::ID
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed, payer = signer, space = 8 + 16,
        seeds = [b"user".as_ref(), signer.key().as_ref(), price_account.key().as_ref(), crate::id().as_ref()], 
        bump = user_bump,
        owner = crate::id()
    )]
    pub user_pda: ProgramAccount<'info, UserInfo>,

    #[account(
        mut, 
        seeds = [b"price".as_ref(), price_account.key().as_ref(), crate::id().as_ref()], 
        bump = pda_bump,
        owner = crate::id()
    )]
    pub store_authority_pda: ProgramAccount<'info, TokenInfo>,

    pub store_mint: Account<'info, Mint>,

    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,

    pub rent: Sysvar<'info, Rent>,

    pub system_program: Program<'info, System>,

}

pub fn handler(ctx: Context<AddVotes>, votes: u64, price: u64) -> ProgramResult {

    // Writable accounts
    let token_info = &mut ctx.accounts.store_authority_pda;
    let user_info = &mut ctx.accounts.user_pda;
    let price_account = &mut ctx.accounts.price_account;
    
    // Readable accounts
    let user_token_account = &ctx.accounts.user_token_account;
    let store_mint = &ctx.accounts.store_mint;

    // 1. Make sure the user_token_account has enough tokens
    if user_token_account.amount < votes {
        return Err(ErrorCode::NotEnoughTokensInAccount.into());
    }

    if price < token_info.min_price {
        return Err(ErrorCode::PriceBelowMinimum.into())
    }

    if token_info.total_votes > 0 {
        let min_price = match price_account.price_per_share.checked_div(5) {
            Some(val) => val,
            None => return Err(ErrorCode::NumericalOverflowError.into()),
        };

        if price < min_price {
            return Err(ErrorCode::PriceTooLow.into());
        }
    
        let max_price = match price_account.price_per_share.checked_mul(5) {
            Some(val) => val,
            None => return Err(ErrorCode::NumericalOverflowError.into()),
        };
    
        if price > max_price {
            return Err(ErrorCode::PriceTooHigh.into());
        }
    }
    
    // 2. Transfer tokens to the store
    if (votes > 0) {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(), 
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.store.to_account_info(),
                    authority: ctx.accounts.signer.to_account_info()
                }
            ), 
            votes
        )?;
    }

    token_info.reserve_total -= match (user_info.votes as u128).checked_mul(user_info.price as u128) {
        Some(val) => match (val).checked_div(1e9 as u128) {
            Some(val) => val as u64,
            None => return Err(ErrorCode::NumericalOverflowError.into()),
        },
        None => return Err(ErrorCode::NumericalOverflowError.into()),
    };

    user_info.price = price;
    user_info.votes += votes;

    token_info.reserve_total += match (user_info.votes as u128).checked_mul(user_info.price as u128) {
        Some(val) => match (val).checked_div(1e9 as u128) {
            Some(val) => val as u64,
            None => return Err(ErrorCode::NumericalOverflowError.into()),
        },
        None => return Err(ErrorCode::NumericalOverflowError.into()),
    };

    token_info.total_votes += votes;
    
    let half_supply = match store_mint.supply.checked_div(2) {
        Some(val) => val,
        None => return Err(ErrorCode::NumericalOverflowError.into()),
    };
    
    if token_info.total_votes > half_supply {
        price_account.allowed_to_combine = true;
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

    Ok(())
}