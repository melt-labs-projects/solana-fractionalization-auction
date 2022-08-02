
use std::str::FromStr;
use std::io::Write;
use borsh::{BorshDeserialize, BorshSerialize};
use anchor_lang::solana_program::{
    program_error::ProgramError, 
    pubkey::Pubkey, 
    borsh::try_from_slice_unchecked,
    instruction::{AccountMeta, Instruction},
    sysvar
};

#[repr(C)]
#[derive(Clone, BorshSerialize, BorshDeserialize, PartialEq)]
pub enum Key {
    Uninitialized,
    SafetyDepositBoxV1,
    ExternalAccountKeyV1,
    VaultV1,
}

pub const MAX_SAFETY_DEPOSIT_SIZE: usize = 1 + 32 + 32 + 32 + 1;
pub const MAX_VAULT_SIZE: usize = 1 + 32 + 32 + 32 + 32 + 1 + 32 + 1 + 32 + 1 + 1 + 8;
pub const MAX_EXTERNAL_ACCOUNT_SIZE: usize = 8 + 1 + 8 + 32 + 1;

//pub const VAULT_PROGRAM_ID: Pubkey = Pubkey::from_str("FMcRJeEKBjD1LU5UyBHvorpep4hVg48ff2C36NX83vtY").unwrap();

#[repr(C)]
#[derive(Clone, BorshSerialize, BorshDeserialize, PartialEq)]
pub enum VaultState {
    Inactive,
    Active,
    Combined,
    Deactivated,
}

#[repr(C)]
#[derive(Clone, BorshSerialize, BorshDeserialize)]
pub struct Vault {
    pub key: Key,
    pub token_program: Pubkey,
    pub fraction_mint: Pubkey,
    pub authority: Pubkey,
    pub fraction_treasury: Pubkey,
    pub redeem_treasury: Pubkey,
    pub allow_further_share_creation: bool,
    pub pricing_lookup_address: Pubkey,
    pub token_type_count: u8,
    pub state: VaultState,
    pub locked_price_per_share: u64,
}

impl anchor_lang::AccountDeserialize for Vault {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self, ProgramError> {
        Vault::try_deserialize_unchecked(buf)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self, ProgramError> {
        let vault: Vault = try_from_slice_unchecked(buf)?;
        Ok(vault)
    }
}

impl anchor_lang::AccountSerialize for Vault {
    fn try_serialize<W: Write>(&self, _writer: &mut W) -> Result<(), ProgramError> {
        Ok(())
    }
}

impl anchor_lang::Owner for Vault {
    fn owner() -> Pubkey {
        Pubkey::from_str("FMcRJeEKBjD1LU5UyBHvorpep4hVg48ff2C36NX83vtY").unwrap()
    }
}

#[repr(C)]
#[derive(Clone, BorshSerialize, BorshDeserialize)]
pub struct Price {
    pub discriminator: u64,
    pub key: Key,
    pub price_per_share: u64,
    pub price_mint: Pubkey,
    pub allowed_to_combine: bool,
}

impl anchor_lang::AccountDeserialize for Price {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self, ProgramError> {
        Price::try_deserialize_unchecked(buf)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self, ProgramError> {
        let price: Price = try_from_slice_unchecked(buf)?;
        Ok(price)
    }
}

impl anchor_lang::AccountSerialize for Price {
    fn try_serialize<W: Write>(&self, _writer: &mut W) -> Result<(), ProgramError> {
        Ok(())
    }
}

impl anchor_lang::Owner for Price {
    fn owner() -> Pubkey {
        Pubkey::from_str("D8K3mcxvwDE7ykDPhL6xGXfkWXhbB1YS2nH3MCS1WmsD").unwrap()
    }
}

pub fn create_combine_vault_instruction(
    program_id: Pubkey,
    vault: Pubkey,
    outstanding_share_token_account: Pubkey,
    paying_token_account: Pubkey,
    fraction_mint: Pubkey,
    fraction_treasury: Pubkey,
    redeem_treasury: Pubkey,
    new_authority: Pubkey,
    vault_authority: Pubkey,
    paying_transfer_authority: Pubkey,
    uncirculated_burn_authority: Pubkey,
    external_pricing_account: Pubkey,
) -> Instruction {
    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(vault, false),
            AccountMeta::new(outstanding_share_token_account, false),
            AccountMeta::new(paying_token_account, false),
            AccountMeta::new(fraction_mint, false),
            AccountMeta::new(fraction_treasury, false),
            AccountMeta::new(redeem_treasury, false),
            AccountMeta::new(new_authority, false),
            AccountMeta::new_readonly(vault_authority, true),
            AccountMeta::new_readonly(paying_transfer_authority, true),
            AccountMeta::new_readonly(uncirculated_burn_authority, false),
            AccountMeta::new_readonly(external_pricing_account, false),
            AccountMeta::new_readonly(anchor_spl::token::ID, false),
        ],
        data: VaultInstruction::CombineVault.try_to_vec().unwrap(),
    }
}

pub fn create_withdraw_tokens_instruction(
    program_id: Pubkey,
    destination: Pubkey,
    safety_deposit_box: Pubkey,
    store: Pubkey,
    vault: Pubkey,
    fraction_mint: Pubkey,
    vault_authority: Pubkey,
    transfer_authority: Pubkey,
    amount: u64,
) -> Instruction {
    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(destination, false),
            AccountMeta::new(safety_deposit_box, false),
            AccountMeta::new(store, false),
            AccountMeta::new(vault, false),
            AccountMeta::new_readonly(fraction_mint, false),
            AccountMeta::new_readonly(vault_authority, true),
            AccountMeta::new_readonly(transfer_authority, false),
            AccountMeta::new_readonly(anchor_spl::token::ID, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
        ],
        data: VaultInstruction::WithdrawTokenFromSafetyDepositBox(AmountArgs { amount })
            .try_to_vec()
            .unwrap(),
    }
}

pub fn create_redeem_shares_instruction(
    program_id: Pubkey,
    outstanding_shares_account: Pubkey,
    proceeds_account: Pubkey,
    fraction_mint: Pubkey,
    redeem_treasury: Pubkey,
    transfer_authority: Pubkey,
    burn_authority: Pubkey,
    vault: Pubkey,
) -> Instruction {
    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(outstanding_shares_account, false),
            AccountMeta::new(proceeds_account, false),
            AccountMeta::new(fraction_mint, false),
            AccountMeta::new(redeem_treasury, false),
            AccountMeta::new_readonly(transfer_authority, false),
            AccountMeta::new_readonly(burn_authority, true),
            AccountMeta::new_readonly(vault, false),
            AccountMeta::new_readonly(anchor_spl::token::ID, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
        ],
        data: VaultInstruction::RedeemShares.try_to_vec().unwrap(),
    }
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct InitVaultArgs {
    pub allow_further_share_creation: bool,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct AmountArgs {
    pub amount: u64,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct NumberOfShareArgs {
    pub number_of_shares: u64,
}

/// Instructions supported by the Fraction program.
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub enum VaultInstruction {
    InitVault(InitVaultArgs),
    AddTokenToInactiveVault(AmountArgs),
    ActivateVault(NumberOfShareArgs),
    CombineVault,
    RedeemShares,
    WithdrawTokenFromSafetyDepositBox(AmountArgs),
    MintFractionalShares(NumberOfShareArgs),
    WithdrawSharesFromTreasury(NumberOfShareArgs),
    AddSharesToTreasury(NumberOfShareArgs),
    UpdateExternalPriceAccount(Price),
    SetAuthority,
}