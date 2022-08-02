use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount};
use anchor_lang::solana_program::sysvar::clock::Clock;
use std::result::Result;

use crate::errors::*;
use crate::state::{Auction, Authority, MAX_FACILITATOR_FEE, MAX_BID_INCREMENT};
use crate::vault::{Vault, Price, VaultState};

pub fn get_current_timestamp() -> Result<u64, ProgramError> {
    Ok(Clock::get()?.unix_timestamp as u64)
}

pub fn assert_auction_has_ended(auction: &Auction) -> ProgramResult {
    let current_timestamp = get_current_timestamp()?;
    if current_timestamp < auction.end_timestamp {
        return Err(AuctionError::AuctionHasNotEnded.into());
    }
    Ok(())
}

pub fn assert_fee_delivered(auction: &Auction) -> ProgramResult {
    if !auction.fee_paid {
        return Err(AuctionError::FeeHasNotBeenDelivered.into());
    }
    Ok(())
}

pub fn assert_fee_not_delivered(auction: &Auction) -> ProgramResult {
    if auction.fee_paid {
        return Err(AuctionError::FeeAlreadyDelivered.into());
    }
    Ok(())
}

pub fn assert_auction_has_not_ended(auction: &Auction) -> ProgramResult {
    let current_timestamp = get_current_timestamp()?;
    if current_timestamp >= auction.end_timestamp {
        return Err(AuctionError::AuctionHasEnded.into());
    }
    Ok(())
}

pub fn assert_sufficient_funds(token_account: &TokenAccount, amount: u64) -> ProgramResult {
    if token_account.amount < amount {
        return Err(AuctionError::InsufficientFunds.into());
    }
    Ok(())
}

pub fn assert_vault_owned_by_auction_program_authority<'info>(vault: &Vault, authority: &Account<'info, Authority>) -> ProgramResult {
    if vault.authority != authority.key() {
        return Err(AuctionError::VaultNotOwnedByAuctionAuthority.into());
    }
    Ok(())
}

pub fn assert_correct_pricing_account<'info>(vault: &Vault, external_pricing_account: &Account<'info, Price>) -> ProgramResult {
    if vault.pricing_lookup_address != external_pricing_account.key() {
        return Err(AuctionError::PriceAccountDoesNotMatchVaultAccount.into());
    }
    Ok(())
}

pub fn assert_vault_allowed_to_combine(external_pricing_account: &Price) -> ProgramResult {
    if !external_pricing_account.allowed_to_combine {
        return Err(AuctionError::VaultCannotCurrentlyBeCombined.into());
    }
    Ok(())
}

pub fn assert_vault_in_active_state(vault: &Vault) -> ProgramResult {
    if vault.state != VaultState::Active {
        return Err(AuctionError::VaultNotInActiveState.into());
    }
    Ok(())
}

pub fn assert_bid_meets_reserve_price(bid: u64, reserve_price: u64) -> ProgramResult {
    if bid < reserve_price {
        return Err(AuctionError::BidLessThanReservePrice.into());
    }
    Ok(())
}

pub fn assert_sufficient_bid(bid: u64, top_bid: u64, bid_increment: u64) -> ProgramResult {
    let minimum_bid_increase = calculate_minimum_bid_increase(top_bid, bid_increment)?;
    if bid < top_bid + minimum_bid_increase {
        return Err(AuctionError::BidTooLow.into());
    }
    Ok(())
}

pub fn assert_not_top_bidder(bidder: &Pubkey, top_bidder: &Pubkey) -> ProgramResult {
    if top_bidder == bidder {
        return Err(AuctionError::CannotWithdrawTopBid.into());
    }
    Ok(())
}

pub fn assert_auction_winner(claimer: &Pubkey, winner: &Pubkey) -> ProgramResult {
    if winner != claimer {
        return Err(AuctionError::NotAuctionWinner.into());
    }
    Ok(())
}

pub fn calculate_minimum_starting_bid(reserve_price: u64, facilitator_fee: u64) -> Result<u64, ProgramError> {
    Ok(match (reserve_price as u128).checked_mul(MAX_FACILITATOR_FEE as u128) {
        Some(x) => match x.checked_div((MAX_FACILITATOR_FEE - facilitator_fee) as u128) {
            Some(val) => val as u64,
            None => return Err(AuctionError::NumericalOverflowError.into()),
        },
        None => return Err(AuctionError::NumericalOverflowError.into())
    })
}

pub fn calculate_minimum_bid_increase(top_bid: u64, bid_increment: u64) -> Result<u64, ProgramError> {
    Ok(match (top_bid as u128).checked_mul(bid_increment as u128) {
        Some(x) => match x.checked_div(MAX_BID_INCREMENT as u128) {
            Some(val) => val as u64,
            None => return Err(AuctionError::NumericalOverflowError.into()),
        },
        None => return Err(AuctionError::NumericalOverflowError.into())
    })
}

pub fn calculate_fee(top_bid: u64, facilitator_fee: u64) -> Result<u64, ProgramError> {
    Ok(match (top_bid as u128).checked_mul(facilitator_fee as u128) {
        Some(x) => match x.checked_div(MAX_FACILITATOR_FEE as u128) {
            Some(val) => val as u64,
            None => return Err(AuctionError::NumericalOverflowError.into()),
        },
        None => return Err(AuctionError::NumericalOverflowError.into())
    })
}

pub fn calculate_redeem_payment(remaining: u64, amount: u64, fraction_supply: u64) -> Result<u64, ProgramError> {
    Ok(match (remaining as u128).checked_mul(amount as u128) {
        Some(x) => match x.checked_div(fraction_supply as u128) {
            Some(val) => val as u64,
            None => return Err(AuctionError::NumericalOverflowError.into()),
        },
        None => return Err(AuctionError::NumericalOverflowError.into()),
    })
}