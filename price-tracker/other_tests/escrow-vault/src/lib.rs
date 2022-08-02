use anchor_lang::prelude::*;
use anchor_spl::token::{Token, Mint, TokenAccount};
use spl_token_vault::instruction::create_init_vault_instruction;
use anchor_lang::solana_program;
use std::io::Write;
use std::ops::Deref;
use std::ops::DerefMut;
use borsh::{BorshDeserialize, BorshSerialize};
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::{
    pubkey::Pubkey,
    sysvar,
};
use spl_token;

declare_id!("HXfFMLeHgiWAM7jk28NX8kR5RN394btAf5tYsUMDXS4U");

#[program]
pub mod escrow_vault {
    use super::*;

    pub fn init_price(ctx: Context<InitPrice>, mint: Pubkey) -> ProgramResult {
        let price = &mut ctx.accounts.price_account;
        //price.price_mint = mint;
        Ok(())
    }

    pub fn initialize_vault(ctx: Context<InitializeVault>, bump: u8) -> ProgramResult {
        let ix = create_init_vault_instruction(
            *ctx.accounts.vault_program.to_account_info().key,
            *ctx.accounts.fractional_share_mint.to_account_info().key,
            *ctx.accounts.redeem_treasury_account.to_account_info().key,
            *ctx.accounts.fraction_treasury_account.to_account_info().key,
            *ctx.accounts.vault_account.to_account_info().key,
            *ctx.accounts.vault_authority.to_account_info().key,
            *ctx.accounts.price_account.to_account_info().key,
            false,
        );

        solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.fractional_share_mint.to_account_info(),
                ctx.accounts.redeem_treasury_account.to_account_info(),
                ctx.accounts.fraction_treasury_account.to_account_info(),
                ctx.accounts.vault_account.to_account_info(),
                ctx.accounts.vault_authority.to_account_info(),
                ctx.accounts.price_account.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
                ctx.accounts.vault_program.clone()
            ]
        );
        
        Ok(())
    }

}

#[derive(Accounts)]
pub struct InitPrice<'info> {

    #[account(init, payer = vault_authority, space = 8 + 42)]
    pub price_account: Account<'info, ExternalPriceAccount>,

    #[account(mut)]
    pub vault_authority: Signer<'info>,

    pub system_program: Program<'info, System>,

}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct InitializeVault<'info> {

    #[account(init, payer = vault_authority, mint::decimals = 9, mint::authority = pda_authority, mint::freeze_authority = pda_authority)]
    pub other_mint: Account<'info, Mint>,

    #[account(init, payer = vault_authority, mint::decimals = 9, mint::authority = pda_authority, mint::freeze_authority = pda_authority)]
    pub fractional_share_mint: Account<'info, Mint>,

    #[account(init, payer = vault_authority, token::mint = other_mint, token::authority = pda_authority)]
    pub redeem_treasury_account: Account<'info, TokenAccount>,

    #[account(init, payer = vault_authority, token::mint = fractional_share_mint, token::authority = pda_authority)]
    pub fraction_treasury_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_authority: Signer<'info>,

    
    //#[account(init, payer = vault_authority, space = 8 + 205)]
    #[account(mut)]
    pub vault_account: Signer<'info>,

    pub price_account: Account<'info, ExternalPriceAccount>,

    pub token_program: Program<'info, Token>,
    
    pub rent: Sysvar<'info, Rent>,

    pub system_program: Program<'info, System>,
    
    pub pda_authority: AccountInfo<'info>,

    pub vault_program: AccountInfo<'info>

}

#[account]
pub struct ExternalPriceAccount {
    pub blah: bool,
    pub price_per_share: u64,
    pub price_mint: Pubkey,
    pub allowed_to_combine: bool
}