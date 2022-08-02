use anchor_lang::prelude::*;

pub const MAX_FACILITATOR_FEE: u64 = 1_000_000_000;
pub const MAX_BID_INCREMENT: u64 = 1_000_000_000;

#[account]
pub struct Auction {

    pub start_timestamp: u64,

    pub end_timestamp: u64,
    
    pub payment_mint: Pubkey,

    pub top_bid: u64,

    pub top_bidder: Pubkey,

    pub reserve_price: u64,

    pub settings: Pubkey,

    pub vault: Pubkey,

    pub payment_treasury: Pubkey,

    pub fee_paid: bool,

    pub locked_payment_per_fraction: u64,

    pub bump: u8,

}

#[account]
pub struct Bid {

    pub bidder: Pubkey,

    pub auction: Pubkey,

    pub amount: u64,

    pub timestamp: u64,

    pub withdrawable: bool,

    pub token_account: Pubkey,

    pub bump: u8,

}

#[account]
pub struct Authority {

    pub owner: Pubkey,

    pub bump: u8

}

#[account]
pub struct Settings {

    pub duration: u64,

    pub soft_close_period: u64,

    pub bid_increment: u64,

    pub facilitator_fee: u64,

}

impl Auction {
    pub fn space() -> usize {
        return 5 * 8 + 5 * 32 + 2 * 1;
    }
}

impl Bid {
    pub fn space() -> usize {
        return 2 * 8 + 3 * 32 + 2;
    }
}

impl Authority {
    pub fn space() -> usize {
        return 1 * 32 + 1;
    }
}

impl Settings {
    pub fn space() -> usize {
        return 4 * 8;
    }
}
