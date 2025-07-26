"""Hardware wallet support for rotki."""

from .trezor import (
    derive_eth_address as derive_eth_address_trezor,
    derive_multiple_eth_addresses as derive_multiple_eth_addresses_trezor,
    get_trezor_device_info,
    is_trezor_connected,
)

from .ledger import (
    derive_eth_address as derive_eth_address_ledger,
    derive_multiple_eth_addresses as derive_multiple_eth_addresses_ledger,
    get_ledger_device_info,
    is_ledger_connected,
)

__all__ = [
    # Trezor functions
    'derive_eth_address_trezor',
    'derive_multiple_eth_addresses_trezor', 
    'get_trezor_device_info',
    'is_trezor_connected',
    # Ledger functions
    'derive_eth_address_ledger',
    'derive_multiple_eth_addresses_ledger',
    'get_ledger_device_info',
    'is_ledger_connected',
] 