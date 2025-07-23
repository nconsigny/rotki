"""Hardware wallet support for rotki."""

from .trezor import (
    derive_eth_address,
    derive_multiple_eth_addresses,
    get_trezor_device_info,
    is_trezor_connected,
)

__all__ = [
    'derive_eth_address',
    'derive_multiple_eth_addresses', 
    'get_trezor_device_info',
    'is_trezor_connected',
] 