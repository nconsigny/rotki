# backend/rotkehlchen/hardware/trezor.py
from trezorlib.client import get_default_client
from trezorlib.tools import parse_path
from trezorlib.ethereum import get_address   # or trezorlib.bitcoin.get_address

def derive_eth_address(index: int = 0) -> str:
    """
    Derive an Ethereum address from a Trezor device at the specified index.
    
    Args:
        index: The derivation index for the BIP-44 path m/44'/60'/0'/0/{index}
        
    Returns:
        The derived Ethereum address as a string
        
    Raises:
        Exception: If the Trezor device is not connected or derivation fails
    """
    client = get_default_client()             # USB/WebUSB native
    path   = parse_path(f"m/44'/60'/0'/0/{index}")
    return get_address(client, path)

def derive_multiple_eth_addresses(count: int = 10, start_index: int = 0) -> list[str]:
    """
    Derive multiple Ethereum addresses from a Trezor device.
    
    Args:
        count: Number of addresses to derive
        start_index: Starting index for derivation
        
    Returns:
        List of derived Ethereum addresses
        
    Raises:
        Exception: If the Trezor device is not connected or derivation fails
    """
    addresses = []
    client = get_default_client()
    
    for i in range(start_index, start_index + count):
        path = parse_path(f"m/44'/60'/0'/0/{i}")
        address = get_address(client, path)
        addresses.append(address)
    
    return addresses

def get_trezor_device_info() -> dict[str, str]:
    """
    Get information about the connected Trezor device.
    
    Returns:
        Dictionary containing device information
        
    Raises:
        Exception: If no Trezor device is connected
    """
    client = get_default_client()
    features = client.features
    
    return {
        'device_id': features.device_id or 'unknown',
        'label': features.label or 'Trezor Device',
        'model': features.model or 'unknown',
        'firmware_version': f"{features.major_version}.{features.minor_version}.{features.patch_version}",
        'vendor': features.vendor or 'SatoshiLabs',
    }

def is_trezor_connected() -> bool:
    """
    Check if a Trezor device is connected and accessible.
    
    Returns:
        True if a Trezor device is connected, False otherwise
    """
    try:
        client = get_default_client()
        return client is not None
    except Exception:
        return False 