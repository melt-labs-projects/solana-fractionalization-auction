use anchor_lang::prelude::*;
use anchor_lang::error;

#[error]
pub enum ErrorCode {

    #[msg("User doesn't have enough tokens in their account")]
    NotEnoughTokensInAccount,

    #[msg("User is trying to remove more votes than they have")]
    NotEnoughVotesToRemove,

    #[msg("Numerical Overflow Error")]
    NumericalOverflowError,

    #[msg("The price must be less than 5x the current weighted average")]
    PriceTooHigh,

    #[msg("The price must be greater than the minimum set price")]
    PriceBelowMinimum,

    #[msg("The price must be greater than 1/5th the current weighted average")]
    PriceTooLow,

    #[msg("Cannot remove zero votes")]
    AmountIsZero,

}