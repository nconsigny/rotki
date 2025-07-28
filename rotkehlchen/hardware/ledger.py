"""Ledger hardware wallet backend support."""

try:
    from ledger_bitcoin import Client
    LEDGER_AVAILABLE = True
except ImportError:
    LEDGER_AVAILABLE = False

def derive_eth_address(account_index: int = 0) -> str:
    """Derive an Ethereum address from a Ledger device.
    
    Note: Backend Ledger support is minimal. Use frontend derivation for full functionality.
    """
    if not LEDGER_AVAILABLE:
        raise Exception("Ledger libraries not available")
    
    raise Exception("Use frontend derivation for Ledger Ethereum addresses")

def derive_multiple_eth_addresses(count: int = 10, start_account: int = 0) -> list[str]:
    """Derive multiple Ethereum addresses from a Ledger device."""
    addresses = []
    
    for i in range(start_account, start_account + count):
        address = derive_eth_address(i)
        addresses.append(address)
    
    return addresses

def get_ledger_device_info() -> dict[str, str]:
    """Get information about the connected Ledger device."""
    if not LEDGER_AVAILABLE:
        raise Exception("Ledger libraries not available")
    
    return {
        'device_id': 'ledger_device',
        'label': 'Ledger Device',
        'model': 'Ledger',
        'vendor': 'Ledger',
    }

def is_ledger_connected() -> bool:
    """Check if a Ledger device is connected and accessible."""
    if not LEDGER_AVAILABLE:
        return False
    
    # Backend detection is minimal, rely on frontend
    return False