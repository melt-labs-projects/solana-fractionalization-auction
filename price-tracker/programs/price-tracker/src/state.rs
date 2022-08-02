use anchor_lang::prelude::*;

#[account]
pub struct TokenInfo {
    pub reserve_total: u64,
    pub total_votes: u64,
    pub min_price: u64,
    pub mint: Pubkey,
    pub store: Pubkey,
    pub locked_mint: Pubkey,
    pub authority: Pubkey,
}

#[account]
pub struct UserInfo {
    pub price: u64,
    pub votes: u64,
}

#[account]
pub struct ExternalPriceAccount {
    pub key: u8,
    pub price_per_share: u64,
    pub price_mint: Pubkey,
    pub allowed_to_combine: bool
}