use anchor_lang::prelude::*;
use anchor_lang::error;

#[error]
pub enum AuctionError {

    #[msg("A numerical error occurred")]
    NumericalOverflowError,

    #[msg("The given price account is not the vault account's pricing lookup address")]
    PriceAccountDoesNotMatchVaultAccount,

    #[msg("The vault is not currently allowed to combined")]
    VaultCannotCurrentlyBeCombined,

    #[msg("The vault is not in the active state")]
    VaultNotInActiveState,

    #[msg("The vault is not owned by the auction authority")]
    VaultNotOwnedByAuctionAuthority,

    #[msg("The bid is not greater than or equal to the reserve price")]
    BidLessThanReservePrice,

    #[msg("The bid is either not larger or not sufficiently larger than the current bid")]
    BidTooLow,

    #[msg("The auction has already finished")]
    AuctionHasEnded,

    #[msg("The auction has not yet finished")]
    AuctionHasNotEnded,

    #[msg("Only the auction winner can claim the winnings")]
    NotAuctionWinner,

    #[msg("Top bid cannot be withdrawn")]
    CannotWithdrawTopBid,

    #[msg("Invalid facilitator fee")]
    InvalidFacilitatorFee,

    #[msg("Paying token account must have at least the bid amount of tokens")]
    InsufficientFunds,

    #[msg("Fee has already been delivered")]
    FeeAlreadyDelivered,

    #[msg("Fee has not yet been delivered")]
    FeeHasNotBeenDelivered,

}